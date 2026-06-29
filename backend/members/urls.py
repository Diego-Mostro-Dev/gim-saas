from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    MemberViewSet,
    PublicMemberPhotoView,
)
from .public_views import PublicRegisterView, PublicSlotsView, PublicPlansView
from activities.public_views import PublicGymActivitiesView

router = DefaultRouter()

router.register(
    r"members",
    MemberViewSet,
    basename="members",
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
]