from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    MeView,
    GymOnboardingView,
    CreateGymOwnerView,
    ChangePasswordView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    AdminResetPasswordView,
)

urlpatterns = [
    # auth
    path("login/", LoginView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("me/", MeView.as_view()),
    path(
        "change-password/",
        ChangePasswordView.as_view(),
    ),
    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
    ),
    path(
        "admin-reset-password/",
        AdminResetPasswordView.as_view(),
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