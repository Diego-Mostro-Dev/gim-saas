from django.urls import path

from rest_framework.routers import DefaultRouter

from .views import (
    WeeklyScheduleView,
    members_by_schedule,
    attendance_status,
    AttendanceCreateView,
    ScheduleSlotListCreateView,
    ScheduleSlotDetailView,
    ScheduleChangeRequestViewSet,
    ScheduleSwapRequestViewSet,
    attendance_analytics,
)

from .public_views import (
    PublicCheckinView,
    PublicMemberSlotsView,
    PublicScheduleChangeRequestView,
    PublicCancelScheduleChangeRequestView,
    PublicScheduleSwapRequestView,
    PublicCancelScheduleSwapRequestView,
)

router = DefaultRouter()
router.register(
    "schedule-change-requests",
    ScheduleChangeRequestViewSet,
    basename="schedule-change-request",
)
router.register(
    "schedule-swap-requests",
    ScheduleSwapRequestViewSet,
    basename="schedule-swap-request",
)

urlpatterns = router.urls + [
    path(
        "weekly/",
        WeeklyScheduleView.as_view(),
        name="weekly-schedule",
    ),

    path(
        "members-by-schedule/",
        members_by_schedule,
        name="members-by-schedule",
    ),

    path(
        "status/",
        attendance_status,
        name="attendance-status",
    ),

    path(
        "register/",
        AttendanceCreateView.as_view(),
        name="attendance-register",
    ),

    path(
        "checkin/<str:token>/",
        PublicCheckinView.as_view(),
        name="attendance-checkin",
    ),
    path(
        "slots/",
        ScheduleSlotListCreateView.as_view(),
        name="slot-list-create",
    ),
    path(
        "slots/<int:pk>/",
        ScheduleSlotDetailView.as_view(),
        name="slot-detail",
    ),

    path(
        "analytics/",
        attendance_analytics,
        name="attendance-analytics",
    ),

    # Public (member-facing) endpoints
    path(
        "public/slots/<str:token>/",
        PublicMemberSlotsView.as_view(),
        name="public-member-slots",
    ),
    path(
        "public/schedule-change-requests/<str:token>/",
        PublicScheduleChangeRequestView.as_view(),
        name="public-schedule-change-request",
    ),
    path(
        "public/schedule-change-requests/<str:token>/<int:pk>/cancel/",
        PublicCancelScheduleChangeRequestView.as_view(),
        name="public-cancel-schedule-change-request",
    ),
    path(
        "public/schedule-swap-requests/<str:token>/",
        PublicScheduleSwapRequestView.as_view(),
        name="public-schedule-swap-request",
    ),
    path(
        "public/schedule-swap-requests/<str:token>/<int:pk>/cancel/",
        PublicCancelScheduleSwapRequestView.as_view(),
        name="public-cancel-schedule-swap-request",
    ),
]