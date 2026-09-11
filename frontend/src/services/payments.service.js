import { API_URL, apiFetch, fetchAllPages } from "./api";

export async function getPayments() {
  return fetchAllPages(
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

export async function exportPaymentsCsv(
  month,
) {
  const token = localStorage.getItem(
    "token",
  );

  const res = await fetch(
    `${API_URL}/api/payments/export/?month=${encodeURIComponent(
      month,
    )}`,
    {
      headers: {
        Authorization:
          token
            ? `Token ${token}`
            : "",
      },
    },
  );

  if (!res.ok) {
    let detail;

    try {
      const body =
        await res.json();

      detail =
        body?.detail;
    } catch {
      // ignorar
    }

    throw new Error(
      detail ||
        "No se pudo descargar el archivo",
    );
  }

  const blob =
    await res.blob();

  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href = url;

  // El backend manda Content-Disposition con el nombre del archivo:
  // pagos-YYYY-MM.csv
  link.download = "";

  document.body.appendChild(
    link,
  );

  link.click();

  document.body.removeChild(
    link,
  );

  URL.revokeObjectURL(
    url,
  );
}
