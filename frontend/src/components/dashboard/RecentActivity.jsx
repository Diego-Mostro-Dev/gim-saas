function RecentActivity({ activity }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-text-primary">Actividad Reciente</h3>

      <div className="divide-y divide-border/5 overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm">
        {activity.length === 0 ? (
          <div className="p-4 text-sm text-text-secondary">
            No hay actividad reciente
          </div>
        ) : (
          activity.map((item) => (
            <div key={item.id} className="flex gap-3 p-4">
              <div className="mt-2 h-2 w-2 rounded-full bg-blue-400" />

              <div>
                <p className="text-sm text-text-primary">{item.description}</p>

                <p className="mt-1 text-xs text-text-secondary">{item.created_at}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default RecentActivity;
