from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    OutingEnrollmentActionViewSet,
    OutingEnrollmentRequestViewSet,
    OutingScheduleViewSet,
    OutingViewSet,
    ScheduleOutingEnrollmentViewSet,
)
from .public_views import (
    PublicMemberOutingsView,
    PublicOutingEnrollmentRequestView,
)


router = DefaultRouter()
router.register(r"outings", OutingViewSet, basename="outings")
router.register(r"enrollments", OutingEnrollmentActionViewSet, basename="outing-enrollment")
router.register(r"requests", OutingEnrollmentRequestViewSet, basename="outing-enrollment-request")

urlpatterns = [
    path(
        "public/<str:token>/",
        PublicMemberOutingsView.as_view(),
        name="outing-member-public-list",
    ),
    path(
        "public/<str:token>/requests/",
        PublicOutingEnrollmentRequestView.as_view(),
        name="outing-member-request-create",
    ),
    path(
        "public/<str:token>/requests/<int:request_id>/",
        PublicOutingEnrollmentRequestView.as_view(),
        name="outing-member-request-cancel",
    ),
    path(
        "<int:outing_id>/schedules/",
        OutingScheduleViewSet.as_view({"get": "list", "post": "create"}),
        name="outing-schedule-list",
    ),
    path(
        "schedules/<int:pk>/",
        OutingScheduleViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="outing-schedule-detail",
    ),
    path(
        "schedules/<int:schedule_id>/enrollments/",
        ScheduleOutingEnrollmentViewSet.as_view({"get": "list"}),
        name="outing-schedule-enrollment-list",
    ),
    path(
        "schedules/<int:schedule_id>/enroll/",
        ScheduleOutingEnrollmentViewSet.as_view({"post": "enroll"}),
        name="outing-schedule-enroll",
    ),
    path(
        "schedules/<int:schedule_id>/unenroll/",
        ScheduleOutingEnrollmentViewSet.as_view({"post": "unenroll"}),
        name="outing-schedule-unenroll",
    ),
] + router.urls