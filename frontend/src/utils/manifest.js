export const STAFF_MANIFEST = "/manifest.json";
export const MEMBER_MANIFEST = "/member-manifest.json";

export function memberManifestHref(token) {
  return `/api/gyms/pwa/member/${token}`;
}

export function staffManifestHref(slug) {
  return `/api/gyms/pwa/staff/${slug}`;
}

export function setManifestHref(href) {
  const link = document.querySelector("link[rel='manifest']");
  if (!link) return;
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}