"""Helpers to link a member's obra social text with the gym's configured one.

Fase K5 · ACC-23: la obra social del socio llegaba como texto libre (alta
pública) y, si no coincidía con ninguna obra configurada en el gym, el
socio quedaba con texto pero sin vínculo: el coseguro por sesión no
tenía de dónde salir y el error se perdía en silencio.

Acá viven las dos piezas compartidas:

- ``normalize_insurance_name``: la comparación sin mayúsculas, sin acentos y
  sin espacios de más que usa el auto-enlace del serializer;
- ``relink_members_for_insurance``: el re-enlace de los socios que ya
  tenían escrita esa obra social cuando el gym la configura (o la renombra).

El módulo no importa serializers a propósito: ``members.serializers`` lo usa
y ``members.models`` lo usa desde un signal, así que cualquier dependencia
de ida y vuelta terminaría en un import circular.
"""

import unicodedata


def normalize_insurance_name(name):
    """Normaliza un nombre para comparar: minúsculas, sin acentos y con
    espacios colapsados. Evita typos como 'IaPOZ' vs 'IAPOS'."""
    if not name:
        return ""
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(text.lower().split())


def relink_members_for_insurance(insurance, previous_name=None):
    """Link the members whose free text matches a configured obra social.

    Only members without a link are touched: a member already pointing to
    another obra keeps it.

    Args:
        insurance: The HealthInsurance to link.
        previous_name: The name the insurance had before a rename. Members
            still carrying the old text were referring to the same obra, so
            they get linked too.

    Returns:
        int: how many members were linked.
    """
    from .models import Member

    normalized = normalize_insurance_name(insurance.name)
    if not normalized:
        return 0

    normalized_previous = normalize_insurance_name(previous_name)

    candidates = (
        Member.objects.filter(gym=insurance.gym, insurance__isnull=True)
        .exclude(health_insurance="")
        .only("id", "health_insurance")
    )

    linked = 0
    for member in candidates.iterator():
        member_normalized = normalize_insurance_name(member.health_insurance)
        if member_normalized == normalized or (
            normalized_previous and member_normalized == normalized_previous
        ):
            Member.objects.filter(pk=member.pk).update(insurance=insurance)
            linked += 1

    return linked


def relink_insurances_for_gym(gym):
    """Relink every configured obra social of a gym.

    Returns:
        int: how many members were linked in total.
    """
    linked = 0
    for insurance in gym.health_insurances.all():
        linked += relink_members_for_insurance(insurance)
    return linked
