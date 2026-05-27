export default function PageHeader({
  title,
  description,
  buttonLabel,
  onButtonClick,
  isFormOpen = false,
}) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>

        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      </div>

      <button
        onClick={onButtonClick}
        className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
      >
        {isFormOpen ? "Cerrar" : buttonLabel}
      </button>
    </div>
  );
}
