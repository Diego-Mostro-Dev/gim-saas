from rest_framework.routers import DefaultRouter

from .views import MembershipPlanViewSet


router = DefaultRouter()
router.register(r'plans', MembershipPlanViewSet)

urlpatterns = router.urls