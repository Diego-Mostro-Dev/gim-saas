import { DAY_ORDER } from "../../constants/days";

const DAY_LABELS = {
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sáb",
  sunday: "Dom",
};

function getCurrentWeekRange() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function WeeklyChart({ data = [] }) {
  const countByDay = Object.fromEntries(data.map((d) => [d.day, d.count]));

  const days = DAY_ORDER.map((key) => ({
    day: DAY_LABELS[key],
    count: countByDay[DAY_LABELS[key]] || 0,
  }));

  const { monday, sunday } = getCurrentWeekRange();
  const weekLabel = `Semana actual · ${monday.toLocaleDateString("es-AR")} – ${sunday.toLocaleDateString("es-AR")}`;

  const maxValue = Math.max(...days.map((item) => item.count), 1);

  return (
    <section className="rounded-xl bg-surface-elevated p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-text-primary">
          Asistencias Semanales
        </h3>

        <p className="text-sm text-text-secondary">{weekLabel}</p>
      </div>

      <div className="flex h-56 items-end gap-3">
        {days.map((item) => {
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
