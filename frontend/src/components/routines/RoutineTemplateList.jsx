function RoutineTemplateList({
  templates = [],
  selectedTemplate,
  onSelectTemplate,
}) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
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
            className={`w-full rounded-2xl border p-4 text-left transition ${
              isSelected
                ? "border-blue-500 bg-blue-500/10"
                : "border-white/5 bg-[#1a1a1a] hover:bg-[#242424]"
            }`}
          >
            <h3 className="font-medium text-white">{template.name}</h3>

            <p className="mt-1 text-sm text-zinc-500">ID #{template.id}</p>
          </button>
        );
      })}
    </div>
  );
}

export default RoutineTemplateList;
