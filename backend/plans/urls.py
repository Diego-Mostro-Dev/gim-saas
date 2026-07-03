from rest_framework.routers import DefaultRouter

from .views import MembershipPlanViewSet, ServiceViewSet


router = DefaultRouter()
router.register(r'plans', MembershipPlanViewSet)
router.register(r'services', ServiceViewSet)

urlpatterns = router.urls