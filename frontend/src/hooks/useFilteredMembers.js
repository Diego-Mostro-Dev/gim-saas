export function useFilteredMembers({
  members,
  searchTerm,
  insuranceUnverifiedOnly = false,
}) {
  const filteredMembers = members.filter((member) => {
    // Fase K5 (ACC-23): las fichas con obra social escrita que el gym no
    // tiene configurada quedan sin coseguro definido. El filtro las deja a
    // la vista para que el staff las enlace.
    if (insuranceUnverifiedOnly && !member.insurance_unverified) return false;

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
