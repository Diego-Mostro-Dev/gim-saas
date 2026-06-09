from django.urls import path

from .views import (
    WeeklyScheduleView,
    members_by_schedule,
    attendance_status,
    AttendanceCreateView,
    ScheduleSlotListCreateView,
    ScheduleSlotDetailView,
)

from .public_views import (
    PublicCheckinView,
)

urlpatterns = [
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
]