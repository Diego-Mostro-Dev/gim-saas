export function useFilteredMembers({
  members,
  searchTerm,
}) {
  const filteredMembers = members.filter((member) => {
    const term = (searchTerm || "").trim().toLowerCase();
    if (!term) return true;
    const haystack = [
      `${member.first_name} ${member.last_name}`,
      member.document_number,
      member.phone,
      member.insurance_name,
      member.affiliate_number,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  return {
    filteredMembers,
  };
}