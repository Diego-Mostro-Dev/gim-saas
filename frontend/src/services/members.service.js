const API_URL =
  "http://localhost:8000/api/members/";

export async function getMembers() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(
      "Error obteniendo miembros"
    );
  }

  return response.json();
}

export async function createMember(memberData) {
  const response = await fetch(API_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(memberData),
  });

  if (!response.ok) {
    throw new Error(
      "Error creando miembro"
    );
  }

  return response.json();
}