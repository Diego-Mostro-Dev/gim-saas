function WeeklyChart({ data = [] }) {
  const maxValue = Math.max(...data.map((item) => item.count), 1);

  return (
    <section className="rounded-xl bg-surface-elevated p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          Asistencias Semanales
        </h3>

        <p className="text-sm text-text-secondary">Últimos 7 días</p>
      </div>

      <div className="flex h-56 items-end gap-3">
        {data.map((item) => {
          const height = item.count === 0 ? 10 : (item.count / maxValue) * 180;

          return (
            <div
              key={item.day}
              className="flex flex-1 flex-col items-center justify-end"
            >
              <span className="mb-2 text-sm text-text-primary">{item.count}</span>

              <div
                className="w-full rounded-t-lg bg-blue-500"
                style={{
                  height: `${height}px`,
                }}
              />

              <span className="mt-2 text-xs text-text-secondary">{item.day}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default WeeklyChart;
