import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Dumbbell, ShieldCheck, MessageCircle, Phone } from "lucide-react";
import toast from "react-hot-toast";

import { DAY_NAMES, DAY_ORDER } from "../constants/days";
import { formatCurrency } from "../utils/currency.utils";
import useAuthStore from "../store/auth.store";
import {
  getPersonalTrainingAssignments,
  getPersonalTrainingServices,
} from "../services/personalTraining.service";

function TrainerAgenda() {
  const navigate = useNavigate();
  const role = useAuthStore((state) => state.role);
  const [assignments, setAssignments] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (role !== "trainer") {
      navigate("/dashboard", { replace: true });
      return;
    }

    async function load() {
      setLoading(true);
      try {
        const [assignmentData, serviceData] = await Promise.all([
          getPersonalTrainingAssignments({ active: true }),
          getPersonalTrainingServices(),
        ]);
        setAssignments(assignmentData);
        setServices(serviceData);
      } catch (err) {
        toast.error(err.message || "Error al cargar tu agenda");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [role, navigate]);

  if (role !== "trainer") {
    return null;
  }

  const serviceById = {};
  services.forEach((s) => {
    serviceById[s.id] = s;
  });

  const grouped = DAY_ORDER.map((day) => ({
    day,
    label: DAY_NAMES[day],
    items: assignments
      .filter((a) => a.day === day)
      .sort((a, b) =>
        `${a.start_time}`.localeCompare(`${b.start_time}`),
      ),
  })).filter((group) => group.items.length > 0);

  const totalAssignments = assignments.length;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 rounded-lg p-2 text-sm text-text-secondary transition hover:bg-surface-input hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Salir
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface-input px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-text-primary">Mi agenda</h2>
          <p className="text-xs text-text-secondary">
            {totalAssignments} cliente
            {totalAssignments === 1 ? "" : "s"} asignado
            {totalAssignments === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-text-secondary">
          Cargando agenda…
        </p>
      ) : grouped.length === 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-surface-elevated p-8 text-center">
          <Dumbbell size={28} className="mx-auto text-text-secondary" />
          <p className="mt-2 text-sm text-text-primary">
            Todavía no tenés clientes asignados.
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Cuando el gimnasio te asigne clientes de entrenamiento personal,
            aparecerán acá.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {grouped.map((group) => (
            <div key={group.day}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-secondary">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.items.map((assignment) => {
                  const service = serviceById[assignment.service];
                  const isPackage = assignment.modality === "package";
                  const start = String(assignment.start_time).slice(0, 5);
                  const end = String(assignment.end_time).slice(0, 5);
                  return (
                    <div
                      key={assignment.id}
                      className="rounded-xl border border-border bg-surface-elevated p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary">
                            {assignment.member.first_name}{" "}
                            {assignment.member.last_name}
                          </p>
                          <p className="mt-0.5 text-xs text-text-secondary">
                            {service?.name || assignment.service_name}
                            {assignment.member_address
                              ? ` · ${assignment.member_address}`
                              : ""}
                          </p>
                          {(assignment.member?.whatsapp ||
                            assignment.member?.phone) && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {assignment.member?.whatsapp && (
                                <a
                                  href={`https://wa.me/${String(
                                    assignment.member.whatsapp
                                  ).replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-success-bg px-1.5 py-0.5 text-[10px] font-medium text-success-text dark:bg-success/15 dark:text-success transition hover:underline"
                                >
                                  <MessageCircle size={11} />
                                  {assignment.member.whatsapp}
                                </a>
                              )}
                              {assignment.member?.phone && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-surface-input px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                                  <Phone size={11} />
                                  {assignment.member.phone}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">
                          <CalendarDays size={13} />
                          {start}–{end}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {service && service.duration_minutes && (
                          <span className="rounded-md bg-muted-bg px-2 py-0.5 text-xs text-muted-text">
                            {service.duration_minutes} min
                          </span>
                        )}
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                            isPackage
                              ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                              : "bg-warning-bg text-warning-text dark:bg-warning/15 dark:text-warning"
                          }`}
                        >
                          {isPackage ? "Paquete" : "Mensual"}
                        </span>
                        {isPackage && (
                          <span className="text-xs text-text-secondary">
                            {assignment.sessions_used}/
                            {assignment.sessions_total} sesiones
                            {Number(assignment.remaining_amount) > 0 &&
                              ` · saldo ${formatCurrency(assignment.remaining_amount)}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrainerAgenda;