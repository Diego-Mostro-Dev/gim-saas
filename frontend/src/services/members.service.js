import { apiFetch } from "./api";

export async function getMembers() {
  return apiFetch("/api/members/");
}

export async function createMember(
  memberData,
) {
  return apiFetch(
    "/api/members/",
    {
      method: "POST",
      body: JSON.stringify(
        memberData,
      ),
    },
  );
}

export async function deleteMember(
  id,
) {
  return apiFetch(
    `/api/members/${id}/`,
    {
      method: "DELETE",
    },
  );
}

export async function updateMember(
  id,
  memberData,
) {
  return apiFetch(
    `/api/members/${id}/`,
    {
      method: "PUT",
      body: JSON.stringify(
        memberData,
      ),
    },
  );
}