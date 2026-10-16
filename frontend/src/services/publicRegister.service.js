import { apiFetch } from "./api";

// El registro público es el único consumidor sin sesión: skipAuth evita mandar
// un token de socio o admin. apiFetch fuerza Accept: application/json, que es
// lo que hace que estos endpoints devuelvan JSON y no la Browsable API en HTML
// cuando el backend corre con DEBUG=True.

export async function registerPublicMember(gymCode, formData) {
  return apiFetch(`/api/public/register/${gymCode}/`, {
    method: "POST",
    body: formData,
    skipAuth: true,
  });
}

export async function getPublicSlots(gymCode) {
  return apiFetch(`/api/public/slots/${gymCode}/`, { skipAuth: true });
}

export async function getPublicPlans(gymCode) {
  return apiFetch(`/api/public/plans/${gymCode}/`, { skipAuth: true });
}

export async function getPublicActivities(gymCode) {
  return apiFetch(`/api/public/activities/${gymCode}/`, { skipAuth: true });
}
