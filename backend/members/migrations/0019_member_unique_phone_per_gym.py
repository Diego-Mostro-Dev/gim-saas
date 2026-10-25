"""Fase K5 · ACC-19: el teléfono es único por gym.

Antes de crear el constraint hay que devolverle el teléfono a los socios
que lo comparten. Re-medido en producción (sólo lectura) agrupando por
``gym_id``: **1 grupo real** (gym 9, teléfono ``000-0000``). La medición
anterior de 12 grupos agrupaba por nombre de gym (hay varios "Test") y era
un falso positivo.

La limpieza va en la propia migración (no en un comando previo) para que un
deploy nunca pueda romper por datos sucios: si quedan duplicados, la
migración los renombra y recién después aplica el constraint. Imprime el
resumen en el log del deploy.

El comando ``cleanup_duplicate_phones`` sirve para revisar el cambio antes
(dry-run) y para correr la limpieza por gym.
"""

from django.db import migrations, models
from django.db.models import Count


def dedupe_phones(apps, schema_editor):
    """Devuelve un teléfono único a cada socio duplicado.

    Usa el modelo histórico de la migración y no el modelo actual: a esta
    altura la tabla todavía no tiene ``deleted_at`` (lo agrega 0020), así
    que un query con el manager actual falla en una base nueva. La lógica
    del sufijo sigue viniendo de ``members.phone_cleanup`` para que el
    comando de limpieza y la migración no se separen.
    """
    from members.phone_cleanup import build_unique_phone

    Member = apps.get_model("members", "Member")

    duplicate_groups = (
        Member.objects.exclude(phone="")
        .order_by()
        .values("gym_id", "phone")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )

    changes = []
    for row in duplicate_groups:
        member_ids = list(
            Member.objects.filter(
                gym_id=row["gym_id"],
                phone=row["phone"],
            )
            .order_by("created_at", "id")
            .values_list("id", flat=True)
        )

        taken = set(
            Member.objects.filter(gym_id=row["gym_id"])
            .exclude(phone=row["phone"])
            .values_list("phone", flat=True)
        )

        for member_id in member_ids[1:]:
            new_phone = build_unique_phone(row["phone"], member_id, taken)
            taken.add(new_phone)
            Member.objects.filter(pk=member_id).update(phone=new_phone)
            changes.append(
                {
                    "gym_id": row["gym_id"],
                    "member_id": member_id,
                    "new_phone": new_phone,
                }
            )

    if changes:
        print(
            f"K5 · ACC-19: se renombró el teléfono de {len(changes)} socios "
            f"({len({c['gym_id'] for c in changes})} gimnasios) antes de "
            "crear el índice único."
        )


def noop(apps, schema_editor):
    """Reversible: la limpieza de datos no se deshace (el teléfono original
    no se puede recuperar de forma segura)."""
    return None


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0032_gym_checkin_window_minutes"),
        ("members", "0018_member_access_token_issued_at"),
    ]

    operations = [
        migrations.RunPython(dedupe_phones, noop),
        migrations.AddConstraint(
            model_name="member",
            constraint=models.UniqueConstraint(
                fields=("gym", "phone"),
                condition=models.Q(("phone", ""), _negated=True),
                name="unique_member_phone_per_gym",
            ),
        ),
    ]
