from rest_framework.routers import DefaultRouter

from .views import (
    ExerciseViewSet,
    RoutineTemplateViewSet,
    RoutineAssignmentViewSet,
    RoutineExerciseViewSet,
    MemberRoutineView,
    MemberRoutineWhatsappView,
    ActiveRoutinesView,
    BulkAssignRoutineView,
    PublicRoutineView,
)
router = DefaultRouter()
from django.urls import path

router.register(
    "exercises",
    ExerciseViewSet,
)

router.register(
    "templates",
    RoutineTemplateViewSet,
)

router.register(
    "assignments",
    RoutineAssignmentViewSet,
)

router.register(
    "routine-exercises",
    RoutineExerciseViewSet,
    basename="routine-exercise",
)




urlpatterns = router.urls + [
    path(
        "member/<int:member_id>/",
        MemberRoutineView.as_view(),
        name="member-routine",
    ),
    path(
        "member/<int:member_id>/whatsapp/",
        MemberRoutineWhatsappView.as_view(),
        name="member-routine-whatsapp",
    ),
    path(
    "active/",
    ActiveRoutinesView.as_view(),
   ),
    path(
        "bulk-assign/",
        BulkAssignRoutineView.as_view(),
        name="bulk-assign-routine",
    ),
    path(
    "public/<str:token>/",
    PublicRoutineView.as_view(),
    name="public-routine",
    ),
]
