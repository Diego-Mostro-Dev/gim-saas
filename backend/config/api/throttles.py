from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    rate = "60/hour"


class OnboardingCreateRateThrottle(AnonRateThrottle):
    rate = "5/hour"


class OnboardingValidateRateThrottle(AnonRateThrottle):
    rate = "30/hour"


class PublicAttendanceRateThrottle(AnonRateThrottle):
    scope = "public_attendance"
    rate = "30/hour"


class PublicMemberRateThrottle(AnonRateThrottle):
    rate = "300/hour"


class PublicRegisterRateThrottle(AnonRateThrottle):
    scope = "public_register"
    rate = "20/hour"
