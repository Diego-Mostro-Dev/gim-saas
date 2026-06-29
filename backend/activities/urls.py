from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    ActivityViewSet,
    ActivityScheduleViewSet,
    EnrollmentViewSet,
    ScheduleEnrollmentViewSet,
)
from .public_views import PublicMemberEnrollmentsView


router = DefaultRouter()
router.register(r"activities", ActivityViewSet, basename="activities")
router.register(r"enrollments", EnrollmentViewSet, basename="enrollments")

urlpatterns = [
    path(
        "<int:activity_id>/schedules/",
        ActivityScheduleViewSet.as_view({"get": "list", "post": "create"}),
        name="activity-schedule-list",
    ),
    path(
        "schedules/<int:pk>/",
        ActivityScheduleViewSet.as_view({
            "get": "retrieve",
            "patch": "partial_update",
            "delete": "destroy",
        }),
        name="activity-schedule-detail",
    ),
    path(
        "schedules/<int:schedule_id>/enrollments/",
        ScheduleEnrollmentViewSet.as_view({"get": "list"}),
        name="schedule-enrollment-list",
    ),
    path(
        "schedules/<int:schedule_id>/enroll/",
        ScheduleEnrollmentViewSet.as_view({"post": "enroll"}),
        name="schedule-enroll",
    ),
    path(
        "schedules/<int:schedule_id>/unenroll/",
        ScheduleEnrollmentViewSet.as_view({"post": "unenroll"}),
        name="schedule-unenroll",
    ),
    path(
        "public/<str:token>/",
        PublicMemberEnrollmentsView.as_view(),
        name="public-member-enrollments",
    ),
] + router.urls
