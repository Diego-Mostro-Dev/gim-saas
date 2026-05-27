import { useMemo } from "react";

export function usePaymentStats(payments) {
  const stats = useMemo(() => {
    const totalAmount = payments.reduce(
      (acc, payment) =>
        acc + Number(payment.amount),
      0,
    );

    const totalPayments =
      payments.length;

    const cashPayments =
      payments.filter(
        (payment) =>
          payment.payment_method ===
          "cash",
      ).length;

    const transferPayments =
      payments.filter(
        (payment) =>
          payment.payment_method ===
          "transfer",
      ).length;

    return {
      totalAmount,
      totalPayments,
      cashPayments,
      transferPayments,
    };
  }, [payments]);

  return stats;
}