"""Limpieza de teléfonos duplicados por gym (Fase K5 · ACC-19).

El teléfono era, en la práctica, la identidad del socio dentro del gym
(el login del portal es el teléfono + documento), pero la base no lo
garantizaba: había grupos de socios con el mismo teléfono en el mismo
gimnasio, y el primer filtro de búsqueda por teléfono elegía uno al azar.

La corrección no es borrar socios (muchos tienen pagos y suscripciones
protegidas): es devolverle el teléfono a cada uno. Al duplicado se le
agrega el sufijo ``-<id>`` para que siga siendo trazable, y el más
antiguo se queda con el teléfono original.

Este módulo lo usan el comando ``cleanup_duplicate_phones`` y la migración
``0019_member_unique_phone_per_gym``. OJO: la migración lo importa, así que
la API pública de acá no puede cambiar sin actualizar esa migración.
"""

from django.db.models import Count

# Member.phone es max_length=30.
PHONE_MAX_LENGTH = 30


def duplicate_phone_groups(gym=None):
    """Devuelve los grupos de socios con el mismo teléfono en el mismo gym.

    Returns:
        list: lista de tuplas ``(gym_id, phone, member_ids)`` con el socio
        más antiguo primero (desempata por id).
    """
    from .models import Member

    qs = (
        Member.objects.exclude(phone="")
        .order_by()  # el orden va en el GROUP BY si no se limpia
        .values("gym_id", "phone")
        .annotate(n=Count("id"))
        .filter(n__gt=1)
    )

    if gym is not None:
        qs = qs.filter(gym_id=getattr(gym, "id", gym))

    groups = []
    for row in qs:
        member_ids = list(
            Member.objects.filter(
                gym_id=row["gym_id"],
                phone=row["phone"],
            )
            .order_by("created_at", "id")
            .values_list("id", flat=True)
        )
        groups.append((row["gym_id"], row["phone"], member_ids))

    return groups


def build_unique_phone(phone, member_id, taken):
    """Arma un teléfono único a partir del original y el id del socio.

    Args:
        phone: teléfono original.
        member_id: id del socio que lo va a usar.
        taken: iterable de teléfonos ya usados en el gym.

    Returns:
        str: teléfono único, de a lo sumo ``PHONE_MAX_LENGTH`` caracteres.
    """
    taken = set(taken)
    suffix = f"-{member_id}"
    candidate = f"{phone[: PHONE_MAX_LENGTH - len(suffix)]}{suffix}"

    counter = 1
    while candidate in taken:
        suffix = f"-{member_id}-{counter}"
        candidate = f"{phone[: PHONE_MAX_LENGTH - len(suffix)]}{suffix}"
        counter += 1

    return candidate


def plan_phone_dedupe(gym=None):
    """Calcula los cambios de teléfono sin tocar la base.

    Returns:
        list: lista de dicts con ``gym_id``, ``phone``, ``member_id``,
        ``old_phone`` y ``new_phone``.
    """
    from .models import Member

    changes = []
    for gym_id, phone, member_ids in duplicate_phone_groups(gym=gym):
        if len(member_ids) < 2:
            continue

        keeper_id = member_ids[0]
        duplicates = member_ids[1:]

        taken = set(
            Member.objects.filter(gym_id=gym_id)
            .exclude(phone=phone)
            .values_list("phone", flat=True)
        )

        for member_id in duplicates:
            new_phone = build_unique_phone(phone, member_id, taken)
            taken.add(new_phone)
            changes.append(
                {
                    "gym_id": gym_id,
                    "phone": phone,
                    "member_id": member_id,
                    "keeper_id": keeper_id,
                    "old_phone": phone,
                    "new_phone": new_phone,
                }
            )

    return changes


def apply_phone_dedupe(gym=None):
    """Aplica los cambios calculados por ``plan_phone_dedupe``.

    Returns:
        list: los cambios efectivamente aplicados.
    """
    from .models import Member

    changes = plan_phone_dedupe(gym=gym)

    for change in changes:
        Member.objects.filter(pk=change["member_id"]).update(
            phone=change["new_phone"]
        )

    return changes
