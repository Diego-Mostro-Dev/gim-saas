import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

import { getMembers } from "../../services/members.service";
import { enrollMember } from "../../services/scheduleEnrollments.service";

const alreadyEnrolledIds = new Set();

function EnrollMemberModal({ scheduleId, enrollments, activity, onClose, onSuccess }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [enrollingId, setEnrollingId] = useState(null);
  const [modality, setModality] = useState("monthly");
  const [packageTotal, setPackageTotal] = useState(10);
  const [sessionPrice, setSessionPrice] = useState("");
  const [selladoAmount, setSelladoAmount] = useState("");
  const [confirmChargeMember, setConfirmChargeMember] = useState(null);

  const isSessionsActivity = activity?.billing_mode === "sessions";

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
    const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  function needsChargeConfirm(member) {
    if (!(Number(activity?.monthly_price) > 0)) return false;
    if (Number(member.plan_price) > 0) return false;
    return !isSessionsActivity || modality === "monthly";
  }

  function handleEnroll(member) {
    if (enrollingId) return;
    if (needsChargeConfirm(member)) {
      setConfirmChargeMember(member);
      return;
    }
    doEnroll(member);
  }

  function resolvePackagePrice(member) {
    let price = sessionPrice;
    if (price === undefined || price === "") {
      price =
        member.insurance_session_price != null
          ? String(member.insurance_session_price)
          : "";
    }
    return price;
  }

  async function doEnroll(member) {
    if (enrollingId) return;

    if (isSessionsActivity && modality === "package") {
      const price = resolvePackagePrice(member);
      if (price === "" || price === undefined) {
        toast.error(
          "Definí el coseguro por sesión. Usá 0 si la obra social cubre la sesión o es sin cargo.",
        );
        return;
      }
    }

    setEnrollingId(member.id);

    try {
      const options = {};
      if (isSessionsActivity) {
        if (modality === "package") {
          options.modality = "package";
          options.package_total_sessions = packageTotal;

          const price = resolvePackagePrice(member);
          if (price !== "") {
            options.session_price = price;
          }

          let sellado = selladoAmount;
          if (sellado === undefined || sellado === "") {
            sellado =
              member.insurance_sellado_amount != null
                ? String(member.insurance_sellado_amount)
                : "";
          }
          if (sellado !== "") {
            options.sellado_amount = sellado;
          }
        } else {
          options.modality = "monthly";
        }
      }

      await enrollMember(scheduleId, member.id, options);
      toast.success("Miembro inscripto correctamente");
      onSuccess();
      onClose();
      setSessionPrice("");
      setSelladoAmount("");
      setModality("monthly");
      setPackageTotal(10);
    } catch (err) {
      const msg = err.message || "Error al inscribir";
      toast.error(msg);
    } finally {
      setEnrollingId(null);
    }
  }

  function handleConfirmCharge() {
    if (!confirmChargeMember) return;
    const member = confirmChargeMember;
    setConfirmChargeMember(null);
    doEnroll(member);
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
              placeholder="Buscar miembro por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-secondary"
              autoFocus
            />
          </div>

        {isSessionsActivity && (
          <div className="mb-4 rounded-xl border border-border bg-surface-elevated p-4">
            <p className="mb-2 text-sm font-medium text-text-primary">
              Modalidad para este socio
            </p>

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-input px-3 py-2.5">
                <input
                  type="radio"
                  name="enroll-modality"
                  value="monthly"
                  checked={modality === "monthly"}
                  onChange={() => setModality("monthly")}
                  className="h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500"
                />
                <span>
                  <span className="block text-sm font-medium text-text-primary">
                    Mensual
                  </span>
                  <span className="block text-xs text-text-secondary">
                    {Number(activity?.monthly_price) > 0
                      ? `Cargo mensual recurrente de $${Number(activity.monthly_price).toLocaleString("es-AR")}/mes (se suma a la membresía)`
                      : "Sin cargo mensual (incluida en la membresía)"}
                  </span>
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface-input px-3 py-2.5">
                <input
                  type="radio"
                  name="enroll-modality"
                  value="package"
                  checked={modality === "package"}
                  onChange={() => setModality("package")}
                  className="h-4 w-4 rounded-full border border-border bg-surface-input text-blue-500"
                />
                <span>
                  <span className="block text-sm font-medium text-text-primary">
                    Paquete de sesiones
                  </span>
                  <span className="block text-xs text-text-secondary">
                    Ej: 10 sesiones por obra social
                  </span>
                </span>
              </label>
            </div>

            {modality === "package" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="package-total" className="mb-1 block text-xs font-medium text-text-primary">
                    Total de sesiones
                  </label>
                  <input
                    id="package-total"
                    type="number"
                    min="1"
                    step="1"
                    value={packageTotal}
                    onChange={(e) => setPackageTotal(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                </div>

                <div>
                  <label htmlFor="session-price" className="mb-1 block text-xs font-medium text-text-primary">
                    Coseguro por sesión $
                  </label>
                  <input
                    id="session-price"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="0 si la cubre su obra social"
                    value={sessionPrice}
                    onChange={(e) => setSessionPrice(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                  <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                    Se autocompleta desde la obra social del socio. Dejá 0 si la
                    obra social cubre la sesión o es sin cargo.
                  </p>
                </div>

                <div>
                  <label htmlFor="sellado-amount" className="mb-1 block text-xs font-medium text-text-primary">
                    Sellado $ (único por paquete)
                  </label>
                  <input
                    id="sellado-amount"
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Vacío si no cobra sellado"
                    value={selladoAmount}
                    onChange={(e) => setSelladoAmount(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-input px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
                  />
                  <p className="mt-1 text-[11px] leading-snug text-text-secondary">
                    Monto único por paquete. Se autocompleta desde su obra social.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {confirmChargeMember && (
          <div className="mb-4 rounded-xl border border-warning/30 bg-warning-bg p-4 dark:bg-warning/10">
            <p className="text-sm font-medium text-warning-text dark:text-warning">
              {confirmChargeMember.first_name} {confirmChargeMember.last_name}{" "}
              tiene un plan sin cargo mensual.
            </p>
            <p className="mt-1 text-xs text-warning-text/80 dark:text-warning/80">
              Al inscribirlo en modalidad mensual se le sumará ${Number(
                activity.monthly_price
              ).toLocaleString("es-AR")}
              /mes a su suscripción. ¿Continuar?
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleConfirmCharge}
                className="rounded-lg bg-warning px-3 py-2 text-xs font-semibold text-white transition hover:brightness-95"
              >
                Confirmar y sumar cargo
              </button>
              <button
                onClick={() => setConfirmChargeMember(null)}
                className="rounded-lg border border-border bg-surface-input px-3 py-2 text-xs font-medium text-text-primary transition hover:bg-surface-hover"
              >
                Cancelar
              </button>
            </div>
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

                    {(member.insurance_name || member.affiliate_number) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-secondary">
                        <span className="truncate">
                          {member.insurance_name || "Sin obra social"}
                        </span>
                        {member.insurance_session_price != null && (
                          <span className="text-info-text dark:text-info">
                            Coseguro $
                            {Number(member.insurance_session_price).toLocaleString("es-AR")}/sesión
                          </span>
                        )}
                        {member.insurance_sellado_amount != null && (
                          <span className="text-warning-text dark:text-warning">
                            Sellado $
                            {Number(member.insurance_sellado_amount).toLocaleString("es-AR")}
                          </span>
                        )}
                        {member.affiliate_number && (
                          <span>Nº {member.affiliate_number}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleEnroll(member)}
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

export default EnrollMemberModal;
