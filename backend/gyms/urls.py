from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    DiscountViewSet,
    GymMeView,
    GymStaffView,
    GymStaffRemoveView,
    GymSeoView,
    GymClosedDateListCreateView,
    GymClosedDateDetailView,
    PwaMemberManifestView,
    PwaStaffManifestView,
    PublicGymView,
)

discounts_router = DefaultRouter()
discounts_router.register(r"me/discounts", DiscountViewSet, basename="discounts")

urlpatterns = [
    path(
        "me/",
        GymMeView.as_view()
    ),
    path(
        "me/closed-dates/",
        GymClosedDateListCreateView.as_view(),
    ),
    path(
        "me/closed-dates/<int:closed_date_id>/",
        GymClosedDateDetailView.as_view(),
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
        "public/<str:gym_code>/",
        PublicGymView.as_view(),
        name="gym-public",
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

urlpatterns += discounts_router.urls
