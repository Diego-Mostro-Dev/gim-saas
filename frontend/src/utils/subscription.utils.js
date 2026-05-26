export function calculateRemainingDays(endDate) {
  const today = new Date();

  const end = new Date(endDate);

  return Math.ceil(
    (end - today) / (1000 * 60 * 60 * 24),
  );
}

export function isSubscriptionExpired(endDate) {
  const today = new Date();

  const end = new Date(endDate);

  return end < today;
}

export function getMemberInitials(name = "") {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2);
}