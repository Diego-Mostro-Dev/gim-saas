from django.db.models import Q


def alive_member_q(field="member"):
    """Q object matching related rows whose Member is not soft-deleted."""
    return Q(**{f"{field}__deleted_at__isnull": True})


def only_alive_members(queryset, field="member"):
    """Exclude rows linked to a soft-deleted Member."""
    return queryset.filter(alive_member_q(field))
