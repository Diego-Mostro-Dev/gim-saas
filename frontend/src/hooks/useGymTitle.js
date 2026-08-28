import { useEffect } from "react";
import { useGym } from "./useGym";
import { MEMBER_MANIFEST, STAFF_MANIFEST, setManifestHref } from "../utils/manifest";

const FALLBACK_FAVICON = "/favicon.svg";

function applyTitleAndBranding(name, faviconIcon) {
  if (name) {
    document.title = name;
  }

  let favicon = document.querySelector("link[rel='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  favicon.type = "image/png";
  favicon.sizes = "32x32";
  favicon.href = faviconIcon || FALLBACK_FAVICON;
}

export function useGymTitle(gym) {
  const staffGym = useGym();
  const resolved = gym || staffGym.gym;
  const name = resolved?.name;
  const faviconIcon =
    resolved?.app_icon_favicon_url ||
    resolved?.app_icon_url ||
    resolved?.logo_url ||
    null;
  const isMemberPortal = Boolean(gym);

  useEffect(() => {
    applyTitleAndBranding(name, faviconIcon);
  }, [name, faviconIcon]);

  useEffect(() => {
    setManifestHref(isMemberPortal ? MEMBER_MANIFEST : STAFF_MANIFEST);
  }, [isMemberPortal]);
}
