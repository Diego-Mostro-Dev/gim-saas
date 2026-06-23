from decimal import Decimal

DEMO_PLANS = [
    {
        "name": "Básico",
        "description": "Plan básico con 3 visitas por semana",
        "price": Decimal("25000.00"),
        "duration_days": 30,
        "weekly_visits": 3,
        "active": True,
    },
    {
        "name": "Estándar",
        "description": "Plan estándar con 5 visitas por semana",
        "price": Decimal("40000.00"),
        "duration_days": 30,
        "weekly_visits": 5,
        "active": True,
    },
    {
        "name": "Premium",
        "description": "Acceso ilimitado al gimnasio",
        "price": Decimal("60000.00"),
        "duration_days": 30,
        "weekly_visits": None,
        "active": True,
    },
    {
        "name": "Estudiante",
        "description": "Plan especial para estudiantes con 3 visitas por semana",
        "price": Decimal("20000.00"),
        "duration_days": 30,
        "weekly_visits": 3,
        "active": True,
    },
]
