function PlanSelector({ plans, selectedPlanId, onSelect }) {
  if (!plans || plans.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-zinc-300">
        Seleccioná tu plan
      </p>

      <div className="space-y-3">
        {plans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;

          const weeklyLabel =
            plan.weekly_visits !== null && plan.weekly_visits !== undefined
              ? `${plan.weekly_visits} visitas/semana`
              : "Acceso ilimitado";

          return (
            <div
              key={plan.id}
              onClick={() => onSelect(plan.id)}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-white/5 bg-[#1a1a1a] hover:border-white/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-zinc-400">
                    {plan.duration_days} días
                  </p>
                  <p className="mt-0.5 text-sm text-blue-400">{weeklyLabel}</p>
                  {plan.description && (
                    <p className="mt-1 text-sm text-zinc-500">
                      {plan.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-white">
                    ${plan.price}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PlanSelector;
