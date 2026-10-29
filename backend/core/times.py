"""Aritmética de horarios: una sola implementación.

Los bloques de entrenamiento tienen duración real (ADD-05, Fase K3): la
hora de fin no siempre es "la de inicio + 1 hora". Antes cada app se
armaba su propio cálculo y el choque con las actividades salía mal.
"""

from datetime import datetime, timedelta


def add_minutes(start, minutes):
    """Suma minutos a una hora y devuelve la hora resultante.

    Args:
        start: datetime.time de inicio.
        minutes: cantidad de minutos a sumar.

    Returns:
        datetime.time con la hora de fin.
    """
    base = datetime.combine(datetime(2000, 1, 1), start)
    return (base + timedelta(minutes=minutes)).time()


def slot_end(slot):
    """Fin de un bloque de gym: hora de inicio + duración real.

    Los horarios del gym tienen ``duration_minutes`` (60 por defecto). Se
    usa ``getattr`` porque el mismo chequeo corre contra objetos que
    todavía no se guardaron.
    """
    duration = getattr(slot, "duration_minutes", None) or 60
    return add_minutes(slot.hour, duration)
