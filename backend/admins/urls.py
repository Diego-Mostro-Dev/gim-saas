from django.urls import path

from .views import AdminFeaturesView, AdminGymListCreateView

urlpatterns = [
    path("gyms/", AdminGymListCreateView.as_view()),
    path("features/", AdminFeaturesView.as_view()),
]