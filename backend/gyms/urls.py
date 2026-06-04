from django.urls import path

from .views import (
    GymCreateView,
    GymListView,
    GymMeView,
)

urlpatterns = [
    path(
        "",
        GymListView.as_view()
    ),

    path(
        "create/",
        GymCreateView.as_view()
    ),

    path(
        "me/",
        GymMeView.as_view()
    ),
]