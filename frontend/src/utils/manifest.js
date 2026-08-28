export const STAFF_MANIFEST = "/manifest.json";
export const MEMBER_MANIFEST = "/member-manifest.json";

export function setManifestHref(href) {
  const link = document.querySelector("link[rel='manifest']");
  if (!link) return;
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}