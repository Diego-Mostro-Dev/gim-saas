const API_BASE =
  `${import.meta.env.VITE_API_URL}/api/public/register`;

export async function registerPublicMember(
  gymCode,
  formData
) {
  const response = await fetch(
    `${API_BASE}/${gymCode}/`,
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