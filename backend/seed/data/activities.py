from datetime import time
from decimal import Decimal

DEMO_ACTIVITIES = [
    {
        "name": "Spinning",
        "description": "Clase de ciclismo indoor de alta intensidad.",
        "instructor_name": "María López",
        "monthly_price": Decimal("15000.00"),
        "schedules": [
            {"day": "monday", "start_time": time(18, 0), "end_time": time(19, 0), "capacity": 12},
            {"day": "wednesday", "start_time": time(18, 0), "end_time": time(19, 0), "capacity": 12},
        ],
    },
    {
        "name": "Funcional",
        "description": "Entrenamiento funcional en circuito.",
        "instructor_name": "Carlos Pérez",
        "monthly_price": Decimal("12000.00"),
        "schedules": [
            {"day": "tuesday", "start_time": time(18, 0), "end_time": time(19, 0), "capacity": 15},
            {"day": "thursday", "start_time": time(18, 0), "end_time": time(19, 0), "capacity": 15},
        ],
    },
    {
        "name": "Yoga",
        "description": "Práctica de yoga para flexibilidad y relajación.",
        "instructor_name": "Ana Gómez",
        "monthly_price": Decimal("10000.00"),
        "schedules": [
            {"day": "monday", "start_time": time(9, 0), "end_time": time(10, 0), "capacity": 10},
            {"day": "friday", "start_time": time(9, 0), "end_time": time(10, 0), "capacity": 10},
        ],
    },
    {
        "name": "Crossfit",
        "description": "Entrenamiento de fuerza y acondicionamiento metabólico.",
        "instructor_name": "Jorge Rodríguez",
        "monthly_price": Decimal("18000.00"),
        "schedules": [
            {"day": "wednesday", "start_time": time(18, 0), "end_time": time(19, 30), "capacity": 15},
            {"day": "saturday", "start_time": time(10, 0), "end_time": time(11, 30), "capacity": 15},
        ],
    },
]