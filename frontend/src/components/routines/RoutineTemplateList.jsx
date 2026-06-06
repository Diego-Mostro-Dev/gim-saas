function RoutineTemplateList({ templates = [] }) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
        No hay plantillas creadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="rounded-2xl border border-white/5 bg-[#1a1a1a] p-4"
        >
          <h3 className="font-medium text-white">{template.name}</h3>

          <p className="mt-1 text-sm text-zinc-500">ID #{template.id}</p>
        </div>
      ))}
    </div>
  );
}

export default RoutineTemplateList;
