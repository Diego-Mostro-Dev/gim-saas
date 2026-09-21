import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BadgePercent, MapPin, Phone, Store } from "lucide-react";
import toast from "react-hot-toast";

import { getPublicCommunity } from "../../services/community.service";

function CommunityPublicPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const result = await getPublicCommunity(token);
      setData(result);
    } catch (err) {
      setError(err.message || "No se pudo cargar la tarjeta de comunidad");
      toast.error(err.message || "No se pudo cargar la tarjeta de comunidad");
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial deliberada (fetch-on-mount): patrón usado en toda la codebase.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    load();
  }, [token]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-text-secondary">
        Cargando tarjeta de comunidad...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 text-danger-text dark:text-danger">
        {error || "No se pudo cargar la tarjeta de comunidad."}
      </div>
    );
  }

  const businesses = data.businesses ?? [];
  const memberName = `${data.member?.first_name ?? ""} ${
    data.member?.last_name ?? ""
  }`.trim();

  return (
    <div className="min-h-screen bg-surface px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-sm">
          <div className="bg-primary px-5 py-4">
            <div className="flex items-center gap-2 text-white">
              <BadgePercent size={22} />
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">
                  Comunidad de descuentos
                </p>
                <p className="truncate text-sm text-white/80">
                  {data.gym_name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 border-b border-border px-5 py-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
              {data.member?.first_name?.charAt(0)}
              {data.member?.last_name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="break-words text-xl font-bold text-text-primary">
                {memberName}
              </p>
              <p className="text-sm text-text-secondary">
                Socio/a del gimnasio
              </p>
            </div>
          </div>

          <div className="px-5 py-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
              Locales adheridos
            </h2>

            {businesses.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface-input px-4 py-3 text-sm text-text-secondary">
                No hay locales adheridos por el momento.
              </div>
            ) : (
              <ul className="space-y-3">
                {businesses.map((business) => (
                  <li
                    key={business.id}
                    className="rounded-xl border border-border bg-surface-input p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">
                          {business.name}
                        </p>
                        {business.category && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                            <Store size={14} className="shrink-0" />
                            {business.category}
                          </p>
                        )}
                        {business.address && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            <MapPin size={14} className="shrink-0" />
                            {business.address}
                          </p>
                        )}
                        {business.contact && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            <Phone size={14} className="shrink-0" />
                            {business.contact}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-lg bg-success-bg px-2.5 py-1 text-sm font-bold text-success-text dark:bg-success/15 dark:text-success">
                        {business.discount}
                      </span>
                    </div>

                    {business.description && (
                      <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-text-secondary">
                        {business.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-5 pb-4 text-center">
            <p className="text-xs text-text-secondary">
              Tarjeta de comunidad · Verificá que el nombre corresponda al
              socio/a que presenta este código.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityPublicPage;