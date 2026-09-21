from django.urls import path

from .public_views import PublicMemberCommunityView
from .views import CommunityBusinessDetailView, CommunityBusinessView


urlpatterns = [
    path(
        "businesses/",
        CommunityBusinessView.as_view(),
        name="community-business-list",
    ),
    path(
        "businesses/<int:business_id>/",
        CommunityBusinessDetailView.as_view(),
        name="community-business-detail",
    ),
    path(
        "public/<str:token>/",
        PublicMemberCommunityView.as_view(),
        name="public-community-member",
    ),
]