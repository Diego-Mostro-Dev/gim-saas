import { Dumbbell, Sparkles } from "lucide-react";

function ServiceStep({ services, onChange, activitiesAvailable }) {
  function handleToggle(key) {
    if (key === "activities" && !activitiesAvailable) return;
    onChange({ ...services, [key]: !services[key] });
  }

  const options = [
    {
      key: "gym",
      label: "Gimnasio",
      description: "Acceso al gimnasio con plan y horarios propios",
      icon: Dumbbell,
    },
    {
      key: "activities",
      label: "Actividades",
      description: activitiesAvailable
        ? "Clases dirigidas con horarios fijos"
        : "No disponible para este gimnasio",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-text-primary">
        ¿Qué servicios querés contratar?
      </p>

      <p className="text-sm text-text-secondary">
        Podés elegir uno o ambos.
      </p>

      <div className="space-y-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = services[opt.key];
          const disabled = opt.key === "activities" && !activitiesAvailable;

          return (
            <div
              key={opt.key}
              onClick={() => handleToggle(opt.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggle(opt.key);
                }
              }}
              className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                selected
                  ? "border-info bg-info-bg"
                  : disabled
                    ? "border-border/30 bg-surface-input/50 opacity-50 cursor-not-allowed"
                    : "border-border bg-surface-elevated hover:border-border"
              }`}
            >
              <div className={`rounded-lg p-2 ${
                selected ? "bg-info text-white" : "bg-surface-input text-text-secondary"
              }`}>
                <Icon size={22} />
              </div>

              <div className="flex-1">
                <p className="font-medium text-text-primary">{opt.label}</p>
                <p className="text-sm text-text-secondary">{opt.description}</p>
              </div>

              <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                selected ? "border-info bg-info" : "border-text-secondary"
              }`}>
                {selected && (
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ServiceStep;
