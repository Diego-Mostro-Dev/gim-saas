const API_BASE =
  `${import.meta.env.VITE_API_URL}/api/public/register`;

export async function registerPublicMember(
  gymCode,
  memberData
) {
  const formData = new FormData();

  formData.append(
    "first_name",
    memberData.first_name
  );

  formData.append(
    "last_name",
    memberData.last_name
  );

  formData.append(
    "phone",
    memberData.phone
  );

  formData.append(
    "email",
    memberData.email || ""
  );

  formData.append(
    "schedules",
    JSON.stringify(
      memberData.schedules || []
    )
  );

  if (memberData.photo) {
    formData.append(
      "photo",
      memberData.photo
    );
  }

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