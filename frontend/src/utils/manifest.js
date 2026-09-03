export const STAFF_MANIFEST = "/manifest.json";
export const MEMBER_MANIFEST = "/member-manifest.json";

export function memberManifestHref(token) {
  return `/api/pwa/manifest/member/${token}`;
}

export function staffManifestHref(slug) {
  return `/api/pwa/manifest/staff/${slug}`;
}

export function resolveManifestHref(dynamicHref, fallbackHref) {
  if (!dynamicHref) return Promise.resolve(fallbackHref);
  return fetch(dynamicHref, { method: "GET" })
    .then((res) => (res.ok ? dynamicHref : fallbackHref))
    .catch(() => fallbackHref);
}

export function setManifestHref(href) {
  const link = document.querySelector("link[rel='manifest']");
  if (!link) return;
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}