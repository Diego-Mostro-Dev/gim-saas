from django.urls import path

from .views import (
    GymMeView,
    PwaMemberManifestView,
    PwaStaffManifestView,
)

urlpatterns = [
    path(
        "me/",
        GymMeView.as_view()
    ),
    path(
        "pwa/member/<str:token>/",
        PwaMemberManifestView.as_view(),
        name="pwa-member-manifest",
    ),
    path(
        "pwa/staff/<slug:slug>/",
        PwaStaffManifestView.as_view(),
        name="pwa-staff-manifest",
    ),
]
