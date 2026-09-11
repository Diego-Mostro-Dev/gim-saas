import { apiFetch } from "./api";

export const ATTACHMENT_CATEGORIES = [
  {
    value: "medical_order",
    label: "Orden médica / sesiones",
  },
  {
    value: "payment_proof",
    label: "Comprobante de pago",
  },
  {
    value: "electro",
    label: "Electrocardiograma / estudios",
  },
  {
    value: "other",
    label: "Otro",
  },
];

export function attachmentCategoryLabel(value) {
  return (
    ATTACHMENT_CATEGORIES.find((c) => c.value === value)?.label || value
  );
}

/*
|--------------------------------------------------------------------------
| PUBLIC (member portal, by access_token)
|--------------------------------------------------------------------------
*/

export async function getPublicAttachments(token) {
  return apiFetch(
    `/api/public/${token}/attachments/`,
    { skipAuth: true },
  );
}

export async function uploadPublicAttachment(
  token,
  file,
  category,
  note,
) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("category", category);

  if (note) {
    formData.append("note", note);
  }

  return apiFetch(
    `/api/public/${token}/attachments/`,
    {
      method: "POST",
      body: formData,
      skipAuth: true,
    },
  );
}

export async function deletePublicAttachment(token, attachmentId) {
  return apiFetch(
    `/api/public/${token}/attachments/${attachmentId}/`,
    {
      method: "DELETE",
      skipAuth: true,
    },
  );
}

/*
|--------------------------------------------------------------------------
| STAFF
|--------------------------------------------------------------------------
*/

export async function getMemberAttachments(memberId) {
  return apiFetch(`/api/members/attachments/?member=${memberId}`);
}

export async function reviewMemberAttachment(attachmentId, reviewed) {
  return apiFetch(
    `/api/members/attachments/${attachmentId}/review/`,
    {
      method: "PATCH",
      body: JSON.stringify({ reviewed }),
    },
  );
}