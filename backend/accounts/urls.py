from django.urls import path

from .views import (
    LoginView,
    MeView,
    GymOnboardingView,
    CreateGymOwnerView,
    ChangePasswordView,
)

urlpatterns = [
    # auth
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
    ),

    # onboarding SaaS
    path(
        "onboarding/validate/<str:code>/",
        GymOnboardingView.as_view(),
    ),
    path(
        "onboarding/create-owner/",
        CreateGymOwnerView.as_view(),
    ),
]