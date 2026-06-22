function PlanSelector({ plans, selectedPlanId, onSelect }) {
  if (!plans || plans.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-text-primary">
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
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(plan.id);
                }
              }}
              role="button"
              tabIndex={0}
              className={`cursor-pointer rounded-xl border p-4 transition ${
                isSelected
                  ? "border-info bg-info-bg"
                  : "border-border bg-surface-elevated hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-text-primary">
                    {plan.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {plan.duration_days} días
                  </p>
                  <p className="mt-0.5 text-sm text-blue-400">{weeklyLabel}</p>
                  {plan.description && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {plan.description}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-info-text dark:text-info">
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
