import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import toast from "react-hot-toast";

import { getMembers } from "../../services/members.service";
import { enrollMember } from "../../services/scheduleEnrollments.service";

const alreadyEnrolledIds = new Set();

function EnrollMemberModal({ scheduleId, enrollments, onClose, onSuccess }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [enrollingId, setEnrollingId] = useState(null);

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

  async function handleEnroll(memberId) {
    if (enrollingId) return;
    setEnrollingId(memberId);

    try {
      await enrollMember(scheduleId, memberId);
      toast.success("Miembro inscripto correctamente");
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.message || "Error al inscribir";
      toast.error(msg);
    } finally {
      setEnrollingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border/10 bg-surface-modal p-6 shadow-2xl">
        {/* HEADER */}
        <div className="mb-4 flex items-center justify-between">
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

        {/* SEARCH */}
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-input px-4 py-3">
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

        {/* LIST */}
        <div className="max-h-80 space-y-2 overflow-y-auto">
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
                  </div>

                  <button
                    onClick={() => handleEnroll(member.id)}
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

        {/* FOOTER */}
        <div className="mt-4 flex justify-end">
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
