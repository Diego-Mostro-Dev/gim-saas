import { useEffect } from "react";
import { useGym } from "./useGym";

const FALLBACK_FAVICON = "/favicon.svg";

function applyTitleAndBranding(name, faviconIcon, manifestIcon) {

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

  const oldManifest = document.querySelector("link[rel='manifest']");
  if (!oldManifest) return;

  if (manifestIcon) {
    const manifest = {
      name: name || "Gimnasio",
      short_name: name || "Gimnasio",
      description: name ? `${name} - Portal del socio` : "Sistema de gestión",
      start_url: "/",
      display: "standalone",
      background_color: "#f8f9fa",
      theme_color: "#6366f1",
      orientation: "portrait-primary",
      lang: "es-AR",
      icons: [
        { src: manifestIcon, sizes: "192x192", type: "image/png" },
        { src: manifestIcon, sizes: "512x512", type: "image/png" },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], {
      type: "application/manifest+json",
    });
    const href = URL.createObjectURL(blob);

    if (oldManifest.dataset.pwaDynamic) {
      URL.revokeObjectURL(oldManifest.href);
    }
    oldManifest.dataset.pwaDynamic = "true";
    oldManifest.href = href;
  } else if (oldManifest.dataset.pwaDynamic) {
    URL.revokeObjectURL(oldManifest.href);
    delete oldManifest.dataset.pwaDynamic;
    oldManifest.href = "/manifest.json";
  }
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
  const manifestIcon = resolved?.app_icon_url || resolved?.logo_url || null;

  useEffect(() => {
    applyTitleAndBranding(name, faviconIcon, manifestIcon);
  }, [name, faviconIcon, manifestIcon]);
}
