import { ClipboardList } from "lucide-react";

function TemplateList({ templates }) {
  if (!templates.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
        No hay plantillas cargadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <div
          key={template.id}
          className="rounded-2xl border border-white/5 bg-[#201f1f] p-4"
        >
          <div className="flex items-center gap-3">
            <ClipboardList size={18} className="text-blue-400" />

            <h3 className="font-medium text-white">{template.name}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TemplateList;
