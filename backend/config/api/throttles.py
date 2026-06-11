from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    rate = "10/hour"


class OnboardingCreateRateThrottle(AnonRateThrottle):
    rate = "5/hour"


class OnboardingValidateRateThrottle(AnonRateThrottle):
    rate = "30/hour"


class PublicAttendanceRateThrottle(AnonRateThrottle):
    rate = "30/hour"


class PublicMemberRateThrottle(AnonRateThrottle):
    rate = "60/hour"
