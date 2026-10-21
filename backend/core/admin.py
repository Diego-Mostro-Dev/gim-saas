"""Utilidades compartidas para el admin de Django.

El admin de Django es una herramienta del operador: cada gimnasio sólo debe
ver sus propias filas (REF-08). ``GymScopedAdminMixin`` aplica ese recorte de
forma uniforme; el superusuario (administrador central) sigue viendo todo.
"""

from django.contrib import admin


class GymScopedAdminMixin:
    """Acota el queryset del admin al gimnasio del usuario logueado.

    El modelo debe colgar del gimnasio. Por defecto se filtra por el campo
    ``gym``; los modelos que llegan al gimnasio por una relación (p. ej.
    ``SubscriptionItem`` → ``subscription__gym``) declaran ``gym_lookup``.

    Un superusuario (el operador central) no se filtra. Un usuario sin perfil
    o sin gimnasio no ve ninguna fila, en vez de ver las de todos.
    """

    # Ruta ORM desde este modelo hasta el gimnasio.
    gym_lookup = "gym"

    # Los modelos con baja lógica exponen ``all_objects``; el admin quiere
    # ver también las filas dadas de baja, así que arranca de ahí.
    use_all_objects = False

    def get_queryset(self, request):
        if self.use_all_objects:
            qs = self.model.all_objects.get_queryset()
        else:
            qs = super().get_queryset(request)

        user = request.user
        if user.is_superuser:
            return qs

        profile = getattr(user, "profile", None)
        gym = getattr(profile, "gym", None)
        if gym is None:
            return qs.none()

        # Cuando el propio gimnasio es la fila (GymAdmin), el filtro compara
        # contra su primary key, no contra el objeto.
        value = gym.pk if self.gym_lookup in ("pk", "id") else gym
        return qs.filter(**{self.gym_lookup: value})
