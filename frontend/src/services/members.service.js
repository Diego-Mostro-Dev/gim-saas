import { apiFetch, fetchAllPages } from "./api";
import { setCached } from "../utils/cache";

export async function getMembers() {
  const data = await fetchAllPages("/api/members/");
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

  if (memberData.plan_id) {
    formData.append("plan_id", memberData.plan_id);
  }

  formData.append(
    "document_number",
    memberData.document_number || "",
  );

  formData.append(
    "date_of_birth",
    memberData.date_of_birth || "",
  );

  formData.append(
    "health_insurance",
    memberData.health_insurance || "",
  );

  formData.append(
    "affiliate_number",
    memberData.affiliate_number || "",
  );

  if (memberData.insurance) {
    formData.append("insurance", memberData.insurance);
  }

  formData.append(
    "schedules",
    JSON.stringify(memberData.schedules || []),
  );

  if (memberData.services) {
    formData.append(
      "services",
      JSON.stringify(memberData.services),
    );
  }

  if (memberData.activity_schedules) {
    formData.append(
      "activity_schedules",
      JSON.stringify(memberData.activity_schedules),
    );
  }

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
    "document_number",
    memberData.document_number || "",
  );

  formData.append(
    "date_of_birth",
    memberData.date_of_birth || "",
  );

  formData.append(
    "health_insurance",
    memberData.health_insurance || "",
  );

  formData.append(
    "affiliate_number",
    memberData.affiliate_number || "",
  );

  if (memberData.insurance !== undefined && memberData.insurance) {
    formData.append("insurance", memberData.insurance);
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

export async function getMemberActivities() {
  return apiFetch("/api/members/activities/");
}