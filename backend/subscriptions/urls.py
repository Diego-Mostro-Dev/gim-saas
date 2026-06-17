from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import SubscriptionViewSet, PlanChangeRequestViewSet
from .public_views import (
    PublicPlanChangeRequestView,
    PublicCancelPlanChangeRequestView,
    PublicCancelRenewalView,
    PublicEnableRenewalView,
)


router = DefaultRouter()
router.register(r'subscriptions', SubscriptionViewSet)
router.register(
    r'plan-change-requests',
    PlanChangeRequestViewSet,
    basename='plan-change-request',
)

urlpatterns = router.urls + [
    path(
        "subscriptions/public/plan-change-requests/<str:token>/",
        PublicPlanChangeRequestView.as_view(),
        name="public-plan-change-request",
    ),
    path(
        "subscriptions/public/plan-change-requests/<str:token>/<int:pk>/cancel/",
        PublicCancelPlanChangeRequestView.as_view(),
        name="public-cancel-plan-change-request",
    ),
    path(
        "subscriptions/public/cancel-renewal/<str:token>/",
        PublicCancelRenewalView.as_view(),
        name="public-cancel-renewal",
    ),
    path(
        "subscriptions/public/enable-renewal/<str:token>/",
        PublicEnableRenewalView.as_view(),
        name="public-enable-renewal",
    ),
]