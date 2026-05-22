function RecentActivity({ activity }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-white">
        Actividad Reciente
      </h3>

      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-[#201f1f]">
        {activity.length === 0 ? (
          <div className="p-4 text-sm text-zinc-400">
            No hay actividad reciente
          </div>
        ) : (
          activity.map((item, index) => (
            <div
              key={index}
              className="flex gap-3 p-4"
            >
              <div className="mt-2 h-2 w-2 rounded-full bg-blue-400"></div>

              <div>
                <p className="text-sm text-white">
                  <span className="font-bold">
                    {item.member}
                  </span>{" "}
                  registró una suscripción{" "}
                  <span className="font-bold">
                    {item.plan}
                  </span>
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {item.paid
                    ? "Pago confirmado"
                    : "Pendiente de pago"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default RecentActivity;