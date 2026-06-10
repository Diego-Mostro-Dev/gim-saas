import { apiFetch } from "./api";
import { setCached } from "../utils/cache";

export async function getMembers() {
  const data = await apiFetch("/api/members/");
  setCached("members", data);
  return data;
}

export async function getMember(id) {
  return apiFetch(`/api/members/${id}/`);
}

export async function getMemberPayments(id) {
  return apiFetch(`/api/members/${id}/payments/`);
}

export async function createMember(memberData) {
  const formData = new FormData();

  formData.append(
    "first_name",
    memberData.first_name,
  );

  formData.append(
    "last_name",
    memberData.last_name,
  );

  formData.append(
    "phone",
    memberData.phone,
  );

  formData.append(
    "email",
    memberData.email || "",
  );

  if (memberData.photo) {
    formData.append(
      "photo",
      memberData.photo,
    );
  }

  formData.append(
    "schedules",
    JSON.stringify(memberData.schedules || []),
  );

  return apiFetch("/api/members/", {
    method: "POST",
    body: formData,
  });
}

export async function deleteMember(id) {
  return apiFetch(`/api/members/${id}/`, {
    method: "DELETE",
  });
}

export async function updateMember(
  id,
  memberData,
) {
  const formData = new FormData();

  formData.append(
    "first_name",
    memberData.first_name,
  );

  formData.append(
    "last_name",
    memberData.last_name,
  );

  formData.append(
    "phone",
    memberData.phone,
  );

  formData.append(
    "email",
    memberData.email || "",
  );

  if (memberData.photo) {
    formData.append(
      "photo",
      memberData.photo,
    );
  }

  formData.append(
    "schedules",
    JSON.stringify(memberData.schedules || []),
  );

  return apiFetch(
    `/api/members/${id}/`,
    {
      method: "PATCH",
      body: formData,
    },
  );
}