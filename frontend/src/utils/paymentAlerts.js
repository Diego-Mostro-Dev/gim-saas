const RECENT_CASH_WINDOW_MS = 24 * 60 * 60 * 1000;

export function findRecentCashPayment(
  payments,
  { subscription, excludeId = null },
) {
  if (!subscription) return null;

  const now = Date.now();

  return (
    payments.find(
      (p) =>
        p.payment_method === "cash" &&
        String(p.subscription) === String(subscription) &&
        (excludeId == null || p.id !== excludeId) &&
        now - new Date(p.paid_at).getTime() < RECENT_CASH_WINDOW_MS,
    ) || null
  );
}
