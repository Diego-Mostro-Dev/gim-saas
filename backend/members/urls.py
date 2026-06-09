from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    MemberViewSet,
    PublicMemberPhotoView,
)
from .public_views import PublicRegisterView

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
        "public/<str:token>/photo/",
        PublicMemberPhotoView.as_view(),
        name="public-member-photo",
    ),
]