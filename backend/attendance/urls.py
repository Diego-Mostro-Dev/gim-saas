from django.urls import path

from .views import (
    WeeklyScheduleView,
    members_by_schedule,
    attendance_status,
    AttendanceCreateView,
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
]