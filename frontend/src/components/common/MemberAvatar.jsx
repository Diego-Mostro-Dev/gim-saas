function MemberAvatar({ photo, firstName, lastName, size = "md" }) {
  const sizeClasses = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-[10px]",
    md: "h-10 w-10 text-xs",
    lg: "h-14 w-14 text-lg",
  };

  const imgSize = size === "xs" || size === "sm" ? 32 : size === "lg" ? 56 : 40;
  const cloudinaryTransform = `/c_fill,w_${imgSize * 2},h_${imgSize * 2},f_auto/`;

  if (photo) {
    return (
      <img
        src={
          photo.includes("cloudinary")
            ? photo.replace("/upload/", `/upload${cloudinaryTransform}`)
            : photo
        }
        alt={`${firstName || ""} ${lastName || ""}`}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ${sizeClasses[size]}`}
      />
    );
  }

  const initial = `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white ${sizeClasses[size]}`}
    >
      {initial || "?"}
    </div>
  );
}

export default MemberAvatar;
