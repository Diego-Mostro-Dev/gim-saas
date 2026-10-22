"""Fase K5 · ACC-19: el teléfono es único por gym.

Antes de crear el constraint hay que devolverle el teléfono a los socios
que lo comparten: en producción había 12 grupos duplicados. La limpieza va
en la propia migración (no en un comando previo) para que un deploy nunca
pueda romper por datos sucios: si quedan duplicados, la migración los
renombra y recién después aplica el constraint.

El comando ``cleanup_duplicate_phones`` sirve para revisar el cambio antes
(dry-run) y para correr la limpieza por gym.
"""

from django.db import migrations, models


def dedupe_phones(apps, schema_editor):
    """Devuelve un teléfono único a cada socio duplicado.

    Importa ``members.phone_cleanup`` (no el modelo histórico) a propósito:
    la lógica del sufijo ``-<id>`` tiene que ser la misma que usa el
    comando de limpieza. Si ese módulo cambia, hay que actualizar esta
    migración también.
    """
    from members.phone_cleanup import apply_phone_dedupe

    apply_phone_dedupe()


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
