from rest_framework import serializers


def member_identity(member):
    """Compact staff-facing identity data for a member instance.

    Used by contextual serializers (attendance, requests, payments,
    subscriptions, enrollments) so the staff UI can identify a member by
    document, phone or health insurance without loading the full object.
    """
    if member is None:
        return None

    insurance = getattr(member, "insurance", None)
    if insurance is not None:
        insurance_name = insurance.name
    else:
        insurance_name = member.health_insurance or None

    photo = None
    if member.photo:
        try:
            photo = member.photo.url
        except Exception:
            photo = str(member.photo)

    return {
        "first_name": member.first_name,
        "last_name": member.last_name,
        "photo": photo,
        "document_number": member.document_number or None,
        "phone": member.phone or None,
        "insurance_name": insurance_name,
        "affiliate_number": member.affiliate_number or None,
    }


class MemberIdentityMixin:
    """Adds a nested ``member_identity`` object to a serializer that has a
    ``member`` relationship."""

    member_identity = serializers.SerializerMethodField()

    def get_member_identity(self, obj):
        return member_identity(getattr(obj, "member", None))
