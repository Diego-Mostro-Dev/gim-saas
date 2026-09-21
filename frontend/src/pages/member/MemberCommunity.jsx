import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import * as QRModule from "react-qr-code";
import { Store, MapPin, Phone } from "lucide-react";
import toast from "react-hot-toast";

import { getPublicCommunity } from "../../services/community.service";

const QRCode = QRModule.QRCode || QRModule.default?.QRCode;

function MemberCommunity() {
  const { token, gym } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const result = await getPublicCommunity(token);
      setData(result);
    } catch (err) {
      toast.error(
        err.message || "Error al cargar la comunidad de descuentos",
      );
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
    return <div className="text-sm text-text-secondary">Cargando...</div>;
  }

  const communityUrl = `${window.location.origin}/comunidad/${token}`;
  const businesses = data?.businesses ?? [];

  return (
    <div className="space-y-4 text-text-primary">
      <div className="rounded-xl bg-surface-elevated p-5 shadow-sm">
        <h2 className="text-lg font-bold">Comunidad de descuentos</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Mostrá este QR en los locales adheridos de{" "}
          <span className="font-medium text-text-primary">{gym?.name}</span>{" "}
          y accedé a sus beneficios presentando tu nombre.
        </p>

        <div className="mt-4 flex justify-center">
          {QRCode && (
            <div className="max-w-full rounded-3xl bg-white p-4 shadow-lg ring-1 ring-black/5">
              <QRCode
                value={communityUrl}
                size={200}
                level="H"
                bgColor="#FFFFFF"
                fgColor="#000000"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
          )}
        </div>

        <p className="mt-3 text-center text-sm font-medium">
          {data?.member?.first_name} {data?.member?.last_name}
        </p>
        <p className="text-center text-xs text-text-secondary">
          {data?.gym_name || gym?.name}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          Locales adheridos
        </h3>

        {businesses.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface-input px-4 py-3 text-sm text-text-secondary">
            Todavía no hay locales adheridos. El gimnasio está armando la
            comunidad de descuentos.
          </div>
        ) : (
          <ul className="space-y-2">
            {businesses.map((business) => (
              <li
                key={business.id}
                className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm"
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
                  <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-sm font-bold text-white">
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
    </div>
  );
}

export default MemberCommunity;