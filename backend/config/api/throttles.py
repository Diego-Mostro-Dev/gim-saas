import hashlib

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


def _member_token_ident(request):
    token = (request.resolver_match.kwargs or {}).get("token", "")
    ident = f"{token}:{request.META.get('REMOTE_ADDR', '')}"
    return hashlib.sha256(ident.encode("utf-8")).hexdigest()[:40]


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"
    rate = "60/hour"


class OnboardingCreateRateThrottle(AnonRateThrottle):
    scope = "onboarding_create"
    rate = "5/hour"


class OnboardingValidateRateThrottle(AnonRateThrottle):
    scope = "onboarding_validate"
    rate = "30/hour"


class PublicAttendanceRateThrottle(AnonRateThrottle):
    scope = "public_attendance"
    rate = "30/hour"


class PublicMemberRateThrottle(AnonRateThrottle):
    scope = "public_member"
    rate = "300/hour"


class PublicRegisterRateThrottle(AnonRateThrottle):
    scope = "public_register"
    rate = "20/hour"


class PasswordResetRequestRateThrottle(AnonRateThrottle):
    scope = "password_reset_request"
    rate = "5/hour"


class PasswordResetConfirmRateThrottle(AnonRateThrottle):
    scope = "password_reset_confirm"
    rate = "10/hour"


class SystemAdminRateThrottle(AnonRateThrottle):
    scope = "system_admin"
    rate = "10/hour"


class UserHeavyRateThrottle(UserRateThrottle):
    scope = "user_heavy"
    rate = "300/hour"


class MemberPortalTokenThrottle(AnonRateThrottle):
    scope = "member_portal_token"
    rate = "600/hour"

    def get_cache_key(self, request, view):
        token = (request.resolver_match.kwargs or {}).get("token")
        if token:
            ident = hashlib.sha256(token.encode("utf-8")).hexdigest()[:40]
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class MemberUploadThrottle(AnonRateThrottle):
    scope = "member_uploads"
    rate = "60/hour"

    def get_cache_key(self, request, view):
        ident = _member_token_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
