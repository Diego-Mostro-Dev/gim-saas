export async function getDashboardData() {
  const response = await fetch(
    "https://gim-saas.onrender.com/api/dashboard/"
  );

  if (!response.ok) {
    throw new Error("Error al obtener dashboard");
  }

  return response.json();
}