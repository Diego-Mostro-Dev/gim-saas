const API_URL =
  "http://192.168.100.89:8000/api/public/register/";

export async function registerPublicMember(memberData) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(memberData),
  });

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