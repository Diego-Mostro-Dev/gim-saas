from django.urls import path

from .views import (
    GymCreateView,
    GymListView,
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
]