from django.contrib import admin

from .models import (
    Exercise,
    RoutineTemplate,
    RoutineExercise,
    RoutineAssignment,
    WorkoutSet,
)


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ("name", "gym", "category", "is_active")
    list_filter = ("gym", "category", "is_active")
    search_fields = ("name",)

    def get_queryset(self, request):
        return self.model.all_objects.get_queryset()


@admin.register(RoutineTemplate)
class RoutineTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "gym", "is_active")
    list_filter = ("gym", "is_active")
    search_fields = ("name",)

    def get_queryset(self, request):
        return self.model.all_objects.get_queryset()


@admin.register(RoutineExercise)
class RoutineExerciseAdmin(admin.ModelAdmin):
    list_display = (
        "routine_template",
        "exercise",
        "order",
        "sets",
        "exercise_type",
        "is_active",
    )
    list_filter = ("routine_template__gym", "exercise_type", "is_active")
    search_fields = (
        "exercise__name",
        "routine_template__name",
    )

    def get_queryset(self, request):
        return self.model.all_objects.get_queryset()


@admin.register(RoutineAssignment)
class RoutineAssignmentAdmin(admin.ModelAdmin):
    list_display = ("member", "routine_template", "gym", "active", "assigned_at")
    list_filter = ("gym", "active")
    search_fields = (
        "member__first_name",
        "member__last_name",
        "routine_template__name",
    )

    readonly_fields = ("assigned_at",)


@admin.register(WorkoutSet)
class WorkoutSetAdmin(admin.ModelAdmin):
    list_display = (
        "routine_assignment",
        "routine_exercise",
        "set_number",
        "completed",
        "date",
    )
    list_filter = ("date", "completed")
    search_fields = (
        "routine_assignment__member__first_name",
        "routine_assignment__member__last_name",
    )
