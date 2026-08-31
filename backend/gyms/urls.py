from django.urls import path

from .views import (
    GymMeView,
    GymStaffView,
    GymStaffRemoveView,
    GymSeoView,
    PwaMemberManifestView,
    PwaStaffManifestView,
)

urlpatterns = [
    path(
        "me/",
        GymMeView.as_view()
    ),
    path(
        "staff/",
        GymStaffView.as_view(),
    ),
    path(
        "staff/<int:user_id>/",
        GymStaffRemoveView.as_view(),
    ),
    path(
        "public/seo/<str:gym_code>/",
        GymSeoView.as_view(),
        name="gym-seo",
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
