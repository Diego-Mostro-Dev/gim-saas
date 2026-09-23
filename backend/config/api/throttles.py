from rest_framework.throttling import AnonRateThrottle


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
