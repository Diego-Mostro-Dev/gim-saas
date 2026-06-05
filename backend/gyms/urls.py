from django.urls import path

from .views import GymMeView

urlpatterns = [
    path(
        "me/",
        GymMeView.as_view()
    ),
]