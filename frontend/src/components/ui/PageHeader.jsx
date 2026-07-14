export default function PageHeader({
  title,
  description,
  buttonLabel,
  onButtonClick,
  isFormOpen = false,
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{title}</h1>

        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>

      <button
        onClick={onButtonClick}
        className="shrink-0 flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-blue-600"
      >
        {isFormOpen ? "Cerrar" : buttonLabel}
      </button>
    </div>
  );
}
