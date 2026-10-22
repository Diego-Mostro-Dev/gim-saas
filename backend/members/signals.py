"""Signals del app de socios (Fase K5 · ACC-23).

Cuando el gym configura (o renombra) una obra social, los socios que ya
tenían escrita esa obra social en texto libre quedan enlazados solos: antes
el texto se quedaba sin vínculo para siempre y el coseguro por sesión
quedaba en 0 sin que nadie lo supiera (ACC-23).
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import HealthInsurance, Member


@receiver(pre_save, sender=HealthInsurance)
def _remember_previous_name(sender, instance, **kwargs):
    """Guarda el nombre anterior de la obra social antes de guardarla."""
    if not instance.pk:
        instance._previous_name = None
        return

    instance._previous_name = (
        HealthInsurance.objects.filter(pk=instance.pk)
        .values_list("name", flat=True)
        .first()
    )


@receiver(post_save, sender=HealthInsurance)
def _relink_members_on_insurance_save(sender, instance, created, **kwargs):
    """Relink the members whose text matches the saved obra social."""
    previous_name = getattr(instance, "_previous_name", None)
    renamed = bool(not created and previous_name and previous_name != instance.name)

    if renamed:
        # El gym renombró la obra social: los socios que ya estaban enlazados
        # quedan con el texto viejo, que ya no existe en la configuración.
        Member.objects.filter(insurance=instance).exclude(
            health_insurance=instance.name
        ).update(health_insurance=instance.name)

    from .insurance import relink_members_for_insurance

    relink_members_for_insurance(
        instance,
        previous_name=previous_name if renamed else None,
    )
