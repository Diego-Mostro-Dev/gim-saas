from .models import Activity


class ActivityService:
    @staticmethod
    def create_activity(gym, service, validated_data):
        if service.gym_id != gym.id:
            raise ValueError("El servicio no pertenece a este gimnasio.")
        _validate_name_unique(gym, validated_data.get("name"), exclude_id=None)
        return Activity.objects.create(service=service, **validated_data)

    @staticmethod
    def update_activity(activity, validated_data):
        gym = activity.service.gym
        if "name" in validated_data:
            _validate_name_unique(gym, validated_data["name"], exclude_id=activity.id)
        if "service" in validated_data:
            service = validated_data["service"]
            if service.gym_id != gym.id:
                raise ValueError("El servicio no pertenece a este gimnasio.")
        for key, value in validated_data.items():
            setattr(activity, key, value)
        activity.save(update_fields=validated_data.keys())
        return activity


def _validate_name_unique(gym, name, exclude_id=None):
    if name is None:
        return
    qs = Activity.objects.filter(name=name, service__gym=gym)
    if exclude_id is not None:
        qs = qs.exclude(id=exclude_id)
    if qs.exists():
        raise ValueError("Ya existe una actividad con ese nombre.")
