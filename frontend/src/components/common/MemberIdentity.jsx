import MemberAvatar from "./MemberAvatar";

function MemberIdentity({
  member,
  name,
  photo,
  identity,
  showAvatar = true,
  showName = true,
  avatarSize = "md",
  dense = false,
  className = "",
}) {
  const src = identity || member || null;

  const fullName =
    name ||
    (src ? `${src.first_name || ""} ${src.last_name || ""}`.trim() : "");

  const documentNumber = src?.document_number;
  const phone = src?.phone;
  const insurance = src?.insurance_name || src?.health_insurance;
  const affiliateNumber = src?.affiliate_number;

  const chips = [];
  if (insurance) {
    chips.push({
      key: "insurance",
      text: affiliateNumber ? `${insurance} · Nº ${affiliateNumber}` : insurance,
      hidePhoneLike: false,
    });
  }
  if (documentNumber) {
    chips.push({ key: "document", text: `DNI ${documentNumber}`, hidePhoneLike: false });
  }
  if (phone) {
    chips.push({ key: "phone", text: phone, hidePhoneLike: true });
  }

  if (!src && !name) return null;

  const chipClass = dense
    ? "hidden sm:inline-flex"
    : "inline-flex";

  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      {showAvatar && (
        <MemberAvatar
          photo={src?.photo ?? photo}
          firstName={src?.first_name}
          lastName={src?.last_name}
          size={avatarSize}
        />
      )}

      <div className="min-w-0">
        {showName && fullName && (
          <p className="truncate font-medium text-text-primary">
            {fullName}
          </p>
        )}

        {chips.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span
                key={chip.key}
                className={`${chip.hidePhoneLike ? chipClass : "inline-flex"} max-w-full items-center rounded-md bg-surface-input px-1.5 py-0.5 text-[11px] font-medium text-text-secondary`}
              >
                <span className="truncate">{chip.text}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberIdentity;