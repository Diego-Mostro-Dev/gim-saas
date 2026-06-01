const API_URL =
  "https://gim-saas.onrender.com/api/members/";

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

export async function deleteMember(id) {
  const response = await fetch(
    `https://gim-saas.onrender.com/api/members/${id}/`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Error eliminando miembro"
    );
  }
}

export async function updateMember(
  id,
  memberData
) {
  const response = await fetch(
    `https://gim-saas.onrender.com/api/members/${id}/`,
    {
      method: "PUT",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify(memberData),
    }
  );

  if (!response.ok) {
    throw new Error(
      "Error actualizando miembro"
    );
  }

  return response.json();
}