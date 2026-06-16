function RoutineTemplateList({
  templates = [],
  selectedTemplate,
  onSelectTemplate,
}) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
        No hay rutinas creadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => {
        const isSelected = selectedTemplate?.id === template.id;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              isSelected
                ? "border-info bg-info-bg"
                : "border-border bg-surface-elevated hover:bg-surface-input shadow-sm"
            }`}
          >
            <h3 className="font-medium text-text-primary">{template.name}</h3>

            <p className="mt-1 text-sm text-text-secondary">ID #{template.id}</p>
          </button>
        );
      })}
    </div>
  );
}

export default RoutineTemplateList;
