import { Link } from "react-router-dom";
import { Dumbbell } from "lucide-react";

import { useFeature } from "../../hooks/useFeature";

function PersonalTrainingCard({ data }) {
  const enabled = useFeature("personal_training");
  if (!enabled) return null;

  const pt = data?.personalTrainingAttendance;
  if (!pt) return null;

  const attended = pt.week_attended ?? 0;
  const noShow = pt.week_no_show ?? 0;
  const total = attended + noShow;
  const rate = pt.attendance_rate ?? 0;

  return (
    <section className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={18} className="text-info-text dark:text-info" />
          <h2 className="text-sm font-semibold text-text-primary">
            Asistencias PT — esta semana
          </h2>
        </div>
        <Link
          to="/personal-training-attendance"
          className="text-xs font-medium text-info-text dark:text-info hover:text-info/80"
        >
          Ver detalle →
        </Link>
      </div>

      {total > 0 ? (
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-text-secondary">
              Asistieron{" "}
              <span className="font-semibold text-success-text dark:text-success">
                {attended}
              </span>{" "}
              / {total}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-input">
              <div
                className="h-full rounded-full bg-success"
                style={{ width: `${Math.min(rate, 100)}%` }}
              />
            </div>
          </div>
          <p className="shrink-0 text-2xl font-bold text-text-primary">
            {rate}%
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">
          Sin sesiones de Personal Training esta semana
        </p>
      )}

      <p className="mt-2 text-xs text-text-secondary">
        {pt.active_assignments ?? 0} asignaciones activas
      </p>
    </section>
  );
}

export default PersonalTrainingCard;