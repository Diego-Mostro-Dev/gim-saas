from django.urls import path

from .views import (
    AdminFeaturesView,
    AdminGymDetailView,
    AdminGymListCreateView,
)

urlpatterns = [
    path("gyms/", AdminGymListCreateView.as_view()),
    path("gyms/<int:pk>/", AdminGymDetailView.as_view()),
    path("features/", AdminFeaturesView.as_view()),
]