from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    HealthInsuranceViewSet,
    MemberAttachmentViewSet,
    MemberViewSet,
    PublicMemberPhotoView,
)
from .public_views import (
    PublicMemberAttachmentDetailView,
    PublicMemberAttachmentListView,
    PublicRegisterView,
    PublicSlotsView,
    PublicPlansView,
)
from activities.public_views import PublicGymActivitiesView

router = DefaultRouter()

router.register(
    r"members/attachments",
    MemberAttachmentViewSet,
    basename="attachments",
)

router.register(
    r"members",
    MemberViewSet,
    basename="members",
)

router.register(
    r"health-insurances",
    HealthInsuranceViewSet,
    basename="health-insurances",
)

urlpatterns = router.urls + [
    path(
        "public/register/<uuid:gym_code>/",
        PublicRegisterView.as_view(),
        name="public-register",
    ),
    path(
        "public/slots/<uuid:gym_code>/",
        PublicSlotsView.as_view(),
        name="public-slots",
    ),
    path(
        "public/plans/<uuid:gym_code>/",
        PublicPlansView.as_view(),
        name="public-plans",
    ),
    path(
        "public/activities/<uuid:gym_code>/",
        PublicGymActivitiesView.as_view(),
        name="public-gym-activities",
    ),
    path(
        "public/<str:token>/photo/",
        PublicMemberPhotoView.as_view(),
        name="public-member-photo",
    ),
    path(
        "public/<str:token>/attachments/",
        PublicMemberAttachmentListView.as_view(),
        name="public-member-attachments",
    ),
    path(
        "public/<str:token>/attachments/<int:attachment_id>/",
        PublicMemberAttachmentDetailView.as_view(),
        name="public-member-attachment-detail",
    ),
]