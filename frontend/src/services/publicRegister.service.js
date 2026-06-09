const API_PUBLIC =
  `${import.meta.env.VITE_API_URL}/api/public`;

export async function registerPublicMember(
  gymCode,
  formData
) {
  const response = await fetch(
    `${API_PUBLIC}/register/${gymCode}/`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.phone?.[0] ||
      data?.detail ||
      "Error al registrarse"
    );
  }

  return data;
}

export async function getPublicSlots(gymCode) {
  const response = await fetch(
    `${API_PUBLIC}/slots/${gymCode}/`,
  );

  if (!response.ok) {
    throw new Error("Error al cargar horarios disponibles");
  }

  return response.json();
}