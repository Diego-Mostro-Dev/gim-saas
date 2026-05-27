export function useFilteredMembers({
  members,
  searchTerm,
}) {
  const filteredMembers = members.filter(
    (member) =>
      `${member.first_name} ${member.last_name}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()),
  );

  return {
    filteredMembers,
  };
}