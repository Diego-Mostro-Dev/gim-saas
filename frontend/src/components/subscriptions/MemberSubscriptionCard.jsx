import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import MemberAvatar from "../common/MemberAvatar";
import { formatHumanDate } from "../../utils/date.utils";
import { formatCurrency } from "../../utils/currency.utils";
import {
  calculateRemainingDays,
  isSubscriptionExpired,
} from "../../utils/subscription.utils";

const ORIGIN_LABELS = {
  onboarding: "Alta",
  auto_renewal: "Renovación automática",
  plan_change: "Cambio de plan",
};

function MemberSubscriptionCard({ member, subscriptions }) {
  const navigate = useNavigate();

  const [historyOpen, setHistoryOpen] = useState(false);

  const currentSub = subscriptions[0];
  const history = subscriptions.slice(1);

  const today = new Date();
  const isActive = currentSub &&
    new Date(currentSub.start_date) <= today &&
    !isSubscriptionExpired(currentSub.end_date);

  const daysRemaining = currentSub
    ? calculateRemainingDays(currentSub.end_date)
    : 0;

  const currentRemaining = currentSub
    ? Number(currentSub.remaining)
    : 0;

  const activeItems = currentSub?.items?.filter(
    (i) => i.status === "active",
  ) || [];

  const memberName = member
    ? `${member.first_name} ${member.last_name}`
    : currentSub?.member_name || "—";

  const firstName = member?.first_name || currentSub?.member_name?.split(" ")[0];
  const lastName = member?.last_name || currentSub?.member_name?.split(" ").slice(1).join(" ");
  const memberPhoto = member?.photo || currentSub?.member_photo;

  return (
    <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <MemberAvatar
          photo={memberPhoto}
          firstName={firstName}
          lastName={lastName}
          size="md"
        />
        <div>
          <p className="font-medium text-text-primary">{memberName}</p>
          {currentSub && (
            <p className="text-sm text-text-secondary">{currentSub.plan_name}</p>
          )}
        </div>
      </div>

      {currentSub ? (
        <>
          <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Inicio</p>
              <p className="text-text-primary">{formatHumanDate(currentSub.start_date)}</p>
            </div>
            <div>
              <p className="text-text-secondary">Fin</p>
              <p className="text-text-primary">{formatHumanDate(currentSub.end_date)}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-md px-2 py-1 text-xs ${
              isActive
                ? "bg-success-bg dark:bg-success/15 text-success-text dark:text-success"
                : "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
            }`}>
              {isActive
                ? `${daysRemaining} ${daysRemaining === 1 ? "día restante" : "días restantes"}`
                : "Vencida"}
            </span>

            <span className={`inline-flex rounded-md px-2 py-1 text-xs ${
              currentSub.paid
                ? "bg-info-bg text-info-text dark:bg-info/15 dark:text-info"
                : "bg-danger-bg dark:bg-danger/15 text-danger-text dark:text-danger"
            }`}>
              {currentSub.paid ? "Pagado" : "Pendiente"}
            </span>

            {currentSub.auto_renew ? (
              <span className="inline-flex rounded-md bg-success-bg dark:bg-success/15 px-2 py-1 text-xs text-success-text dark:text-success">
                Renovación automática
              </span>
            ) : (
              <span className="inline-flex rounded-md bg-warning-bg dark:bg-warning/15 px-2 py-1 text-xs text-warning-text dark:text-warning">
                Sin renovación
              </span>
            )}
          </div>

          <div className="mt-2 text-xs text-text-secondary">
            Origen: {ORIGIN_LABELS[currentSub.origin] || currentSub.origin}
          </div>

          <div className="mt-3 border-t border-border pt-3 space-y-2">
            <p className="text-xs font-semibold text-text-secondary">Servicios incluidos</p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary-bg dark:bg-primary/10 px-2.5 py-1 text-xs text-primary-text dark:text-primary">
                {currentSub.plan_name}
              </span>
              {activeItems.filter((i) => i.item_type === "activity").map((item) => (
                <span
                  key={item.id}
                  className="inline-flex items-center gap-1 rounded-md bg-success-bg dark:bg-success/15 px-2.5 py-1 text-xs text-success-text dark:text-success"
                >
                  {item.activity_name || item.name_snapshot}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2 mt-2">
              <p className="text-xs font-semibold text-text-secondary">Total</p>
              <p className="text-sm font-semibold text-text-primary">
                ${Number(currentSub.total ?? currentSub.plan_price).toLocaleString("es-AR")}
              </p>
            </div>

            {currentRemaining > 0 && (
              <button
                onClick={() =>
                  navigate("/payments", {
                    state: {
                      prefillMemberId: member?.id ?? currentSub.member,
                      prefillSubscriptionId: currentSub.id,
                    },
                  })
                }
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600"
              >
                Registrar pago · Restan {formatCurrency(currentRemaining)}
              </button>
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="flex w-full items-center justify-between text-sm text-text-secondary hover:text-text-primary"
              >
                <span>Historial ({history.length} {history.length === 1 ? "ciclo" : "ciclos"})</span>
                {historyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {historyOpen && (
                <div className="mt-2 space-y-2">
                  {history.map((sub) => {
                    const subActivities = sub.items?.filter(
                      (i) => i.item_type === "activity" && i.status === "active",
                    ) || [];
                    return (
                      <div key={sub.id} className="rounded-lg bg-surface p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-text-primary">{sub.plan_name}</span>
                          <span className={`text-xs ${
                            sub.paid
                              ? "text-success-text dark:text-success"
                              : "text-danger-text dark:text-danger"
                          }`}>
                            {sub.paid ? "Pagado" : "Pendiente"}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
                          <span>{formatHumanDate(sub.start_date)} — {formatHumanDate(sub.end_date)}</span>
                          <span>${Number(sub.total ?? sub.plan_price).toLocaleString("es-AR")}</span>
                        </div>
                        {subActivities.length > 0 && (
                          <div className="mt-1 text-xs text-text-secondary">
                            {subActivities.map((i) => i.activity_name || i.name_snapshot).join(", ")}
                          </div>
                        )}
                        <div className="mt-0.5 text-xs text-text-secondary">
                          {ORIGIN_LABELS[sub.origin] || sub.origin}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 text-sm text-text-secondary">
          Sin ciclos de membresía
        </div>
      )}
    </div>
  );
}

export default MemberSubscriptionCard;
