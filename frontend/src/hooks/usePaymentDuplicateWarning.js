import { useRef, useState } from "react";

import { findRecentCashPayment } from "../utils/paymentAlerts";

export function usePaymentDuplicateWarning(payments) {
  const [warningPayment, setWarningPayment] = useState(null);

  const pendingSubmitRef = useRef(null);

  function checkBeforeSubmit({
    paymentMethod,
    subscription,
    excludeId,
    submitFn,
  }) {
    const submitNow = () => {
      pendingSubmitRef.current = null;
      return submitFn();
    };

    if (paymentMethod !== "cash") {
      return submitNow();
    }

    const existing = findRecentCashPayment(payments, {
      subscription,
      excludeId,
    });

    if (existing) {
      setWarningPayment(existing);
      pendingSubmitRef.current = submitNow;
      return undefined;
    }

    return submitNow();
  }

  function confirm() {
    const submit = pendingSubmitRef.current;
    if (!submit) return;

    submit();
  }

  function dismiss() {
    pendingSubmitRef.current = null;
    setWarningPayment(null);
  }

  return {
    warningPayment,
    checkBeforeSubmit,
    confirm,
    dismiss,
  };
}
