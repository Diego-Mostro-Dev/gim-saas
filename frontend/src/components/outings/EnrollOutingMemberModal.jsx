import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

import { getMembers } from "../../services/members.service";
import { enrollOutingMember } from "../../services/outingsEnrollments.service";
import MemberIdentity from "../common/MemberIdentity";

const alreadyEnrolledIds = new Set();

function EnrollOutingMemberModal({ scheduleId, enrollments, outing, onClose, onSuccess }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [enrollingId, setEnrollingId] = useState(null);
  const [modality, setModality] = useState("monthly");
  const [packageTotal, setPackageTotal] = useState(10);
  const [sessionPrice, setSessionPrice] = useState("");

  const isSessionsOuting = outing?.billing_mode === "sessions";

  useEffect(() => {
    alreadyEnrolledIds.clear();
    enrollments.forEach((e) => {
      if (e.active !== false) {
        alreadyEnrolledIds.add(e.member.id);
      }
    });
  }, [enrollments]);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getMembers();
        setMembers(data);
      } catch {
        toast.error("Error al cargar miembros");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredMembers = members.filter((m) => {
    if (alreadyEnrolledIds.has(m.id)) return false;

    if (!m.subscription_active) return false;

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const haystack = [
      `${m.first_name} ${m.last_name}`,
      m.document_number,
      m.phone,
      m.insurance_name,
      m.affiliate_number,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  async function doEnroll(member) {
    if (enrollingId) return;

    if (isSessionsOuting && modality === "package") {
      const price = sessionPrice === "" || sessionPrice === undefined ? "" : sessionPrice;
      if (price === "") {
        toast.error(
          "Definí el precio por sesión. Usá 0 si es sin cargo.",
        );
        return;
      }
    }

    setEnrollingId(member.id);

    try {
      const options = {};
      if (isSessionsOuting) {
        if (modality === "package") {
          options.modality = "package";
          options.package_total_sessions = packageTotal;
          if (sessionPrice !== "") {
            options.session_price = sessionPrice;
          }
        } else {
          options.modality = "monthly";
        }
      }

      await enrollOutingMember(scheduleId, member.id, options);
      toast.success("Miembro inscripto correctamente");
      onSuccess();
      onClose();
      setSessionPrice("");
      setModality("monthly");
      setPackageTotal(10);
    } catch (err) {
      toast.error(err.message || "Error al inscribir");
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl border border-border/10 bg-surface-modal p-4 shadow-2xl sm:p-6">
        {/* HEADER */}
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h2 className="text-xl font-bold text-text-primary">
            Inscribir miembro
          </h2>

          <button
            onClick={onClose}
            className="text-text-secondary transition hover:text-text-primary"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* SEARCH */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-input px-4 py-3">
            <Search size={18} className="text-text-secondary" />

            <input
              type="text"
              placeholder="Buscar por nombre, DNI, teléfono u obra social..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              autoFocus
            />
          </div>

          {isSessionsOuting && (
            <div className="mb-4 rounded-xl border border-border bg-surface-elevated p-4">
              <p className="mb-2 text-sm font-medium text-text-primary">
                Modalidad para este socio
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-input px-3 py-2.5">
                  <input
                    type="radio"
                    name="outingenroll-modality"
                    value="monthly"
                    checked={modality === "monthly"}
                    onChange={() => setModality("monthly")}
                    className="h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500"
                  />
                  <span className="block text-sm font-medium text-text-primary">
                    Mensual
                  </span>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-input px-3 py-2.5">
                  <input
                    type="radio"
                    name="outingenroll-modality"
                    value="package"
                    checked={modality === "package"}
                    onChange={() => setModality("package")}
                    className="h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500"
                  />
                  <span className="block text-sm font-medium text-text-primary">
                    Paquete de sesiones
                  </span>
                </label>
              </div>

              {modality === "package" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="outingenroll-package-total" className="mb-1 block text-xs font-medium text-text-primary">
                      Total de sesiones
                    </label>
                    <input
                      id="outingenroll-package-total"
                      type="number"
                      min="1"
                      step="1"
                      value={packageTotal}
                      onChange={(e) => setPackageTotal(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="outingenroll-session-price" className="mb-1 block text-xs font-medium text-text-primary">
                      Precio por sesión $
                    </label>
                    <input
                      id="outingenroll-session-price"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0 si es sin cargo"
                      value={sessionPrice}
                      onChange={(e) => setSessionPrice(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* LIST */}
          <div className="space-y-2">
            {loading ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                Cargando miembros...
              </p>
            ) : filteredMembers.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-secondary">
                {searchTerm
                  ? "No se encontraron miembros con ese nombre."
                  : "No hay miembros disponibles para inscribir."}
              </p>
            ) : (
              filteredMembers.map((member) => {
                const initial = (member.first_name?.[0] || "").toUpperCase();

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-3 shadow-sm"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-sm font-bold text-info-text dark:bg-info/15 dark:text-info">
                      {initial}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {member.first_name} {member.last_name}
                      </p>

                      {member.plan_name && (
                        <div className="mt-0.5 flex items-center gap-2">
                          <span className="rounded-md bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text dark:bg-success/15 dark:text-success">
                            {member.plan_name}
                          </span>

                          <span
                            className={`text-[10px] ${
                              !member.subscription_active
                                ? "text-danger-text"
                                : "text-text-secondary"
                            }`}
                          >
                            {!member.subscription_active
                              ? "Vencido"
                              : member.subscription_days_remaining != null
                                ? `${member.subscription_days_remaining} días`
                                : "Activo"}
                          </span>
                        </div>
                      )}

                      {member.insurance_name && (
                        <MemberIdentity
                          member={member}
                          showAvatar={false}
                          showName={false}
                          className="mt-0.5"
                        />
                      )}
                    </div>

                    <button
                      onClick={() => doEnroll(member)}
                      disabled={enrollingId === member.id}
                      className="shrink-0 rounded-lg bg-blue-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-600 disabled:opacity-60"
                    >
                      {enrollingId === member.id
                        ? "Inscribiendo..."
                        : "Inscribir"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>{/* end scrollable content */}

        {/* FOOTER */}
        <div className="mt-4 flex shrink-0 justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-border bg-surface-input px-5 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default EnrollOutingMemberModal;