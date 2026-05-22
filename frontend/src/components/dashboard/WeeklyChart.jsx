function WeeklyChart() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-[#201f1f] p-4">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Tráfico Semanal
          </h3>

          <p className="text-sm text-zinc-400">
            Promedio diario: 184 atletas
          </p>
        </div>

        <div className="rounded-lg bg-white/5 px-3 py-1 text-xs text-zinc-400">
          Aug 14 - Aug 21
        </div>
      </div>

      <div className="relative h-32 w-full">
        <svg
          viewBox="0 0 300 100"
          className="absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0066ff" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0066ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d="M0,80 Q50,20 100,50 T200,30 T300,10 L300,100 L0,100 Z"
            fill="url(#lineGrad)"
          />

          <path
            d="M0,80 Q50,20 100,50 T200,30 T300,10"
            fill="none"
            stroke="#0066ff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </section>
  );
}

export default WeeklyChart;