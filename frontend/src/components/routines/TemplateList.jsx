import { ClipboardList } from "lucide-react";

function TemplateList({ templates }) {
  if (!templates.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-text-secondary">
        No hay rutinas cargadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <ClipboardList size={18} className="text-blue-400" />

            <h3 className="font-medium text-text-primary">{template.name}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TemplateList;
