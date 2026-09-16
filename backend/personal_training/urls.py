from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    PersonalTrainingAssignmentViewSet,
    PersonalTrainingChangeRequestViewSet,
    PersonalTrainingServiceViewSet,
    TrainerViewSet,
)
from .public_views import (
    PublicMemberPersonalTrainingView,
    PublicMemberChangeRequestView,
)


router = DefaultRouter()
router.register(
    r"services", PersonalTrainingServiceViewSet, basename="pt-services"
)
router.register(r"trainers", TrainerViewSet, basename="pt-trainers")
router.register(
    r"assignments", PersonalTrainingAssignmentViewSet, basename="pt-assignment"
)
router.register(
    r"change-requests",
    PersonalTrainingChangeRequestViewSet,
    basename="pt-change-request",
)

urlpatterns = [
    path(
        "public/<str:token>/",
        PublicMemberPersonalTrainingView.as_view(),
        name="public-pt-member",
    ),
    path(
        "public/<str:token>/change-requests/",
        PublicMemberChangeRequestView.as_view(),
        name="public-pt-change-request-create",
    ),
    path(
        "public/<str:token>/change-requests/<int:request_id>/",
        PublicMemberChangeRequestView.as_view(),
        name="public-pt-change-request-cancel",
    ),
] + router.urls