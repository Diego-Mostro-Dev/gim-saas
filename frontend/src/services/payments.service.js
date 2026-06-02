import { apiFetch } from "./api";

export async function getPayments() {
  return apiFetch(
    "/api/payments/",
  );
}

export async function createPayment(
  data,
) {
  return apiFetch(
    "/api/payments/",
    {
      method: "POST",
      body: JSON.stringify(
        data,
      ),
    },
  );
}

export async function updatePayment(
  id,
  data,
) {
  return apiFetch(
    `/api/payments/${id}/`,
    {
      method: "PUT",
      body: JSON.stringify(
        data,
      ),
    },
  );
}

export async function deletePayment(
  id,
) {
  return apiFetch(
    `/api/payments/${id}/`,
    {
      method: "DELETE",
    },
  );
}