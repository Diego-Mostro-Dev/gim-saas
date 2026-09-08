import { apiFetch } from "./api";

export async function getScheduleEnrollments(scheduleId) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/enrollments/`);
}

export async function getScheduleEnrollmentCount(scheduleId) {
  const data = await apiFetch(
    `/api/activities/schedules/${scheduleId}/enrollments/?page=1&page_size=1`
  );
  return data.totalCount ?? 0;
}

export async function unenrollMember(scheduleId, memberId) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/unenroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId }),
  });
}

export async function enrollMember(scheduleId, memberId, options = {}) {
  return apiFetch(`/api/activities/schedules/${scheduleId}/enroll/`, {
    method: "POST",
    body: JSON.stringify({ member_id: memberId, ...options }),
  });
}

export async function recordSession(enrollmentId, date) {
  return apiFetch(
    `/api/activities/enrollments/${enrollmentId}/record-session/`,
    {
      method: "POST",
      body: JSON.stringify({ date }),
    }
  );
}

export async function removeSession(enrollmentId, date) {
  return apiFetch(
    `/api/activities/enrollments/${enrollmentId}/remove-session/`,
    {
      method: "POST",
      body: JSON.stringify({ date }),
    }
  );
}

export async function renewEnrollment(enrollmentId, additionalSessions) {
  return apiFetch(`/api/activities/enrollments/${enrollmentId}/renew/`, {
    method: "POST",
    body: JSON.stringify({ additional_sessions: additionalSessions }),
  });
}

export async function toggleSellado(enrollmentId) {
  return apiFetch(
    `/api/activities/enrollments/${enrollmentId}/toggle-sellado/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    }
  );
}

export async function paySellado(enrollmentId, amount, paymentMethod = "cash") {
  return apiFetch(
    `/api/activities/enrollments/${enrollmentId}/pay_sellado/`,
    {
      method: "POST",
      body: JSON.stringify({ amount, payment_method: paymentMethod }),
    }
  );
}

export async function recordEnrollmentPayment(
  enrollmentId,
  amount,
  paymentMethod = "cash"
) {
  return apiFetch(
    `/api/activities/enrollments/${enrollmentId}/record_payment/`,
    {
      method: "POST",
      body: JSON.stringify({ amount, payment_method: paymentMethod }),
    }
  );
}
