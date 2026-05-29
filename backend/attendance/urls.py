from django.urls import path

from .views import WeeklyScheduleView

urlpatterns = [
    path(
        "weekly/",
        WeeklyScheduleView.as_view(),
        name="weekly-schedule",
    ),
]