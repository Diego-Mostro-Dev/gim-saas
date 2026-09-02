const BACKEND_BASE =
  process.env.BACKEND_URL || "https://gim-saas.onrender.com";

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function buildHtml(data) {
  const title = data.title || data.name || "Gimnasio";
  const description = data.description || "";
  const keywords = data.keywords || "";
  const canonical = data.canonical_url || "";
  const ogImage = data.og_image_url || "";
  const name = data.name || "Gimnasio";
  const city = data.city || "";
  const address = data.address || "";
  const hours = data.hours || "";
  const phone = data.phone || "";
  const email = data.email || "";
  const whatsapp = data.whatsapp || "";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Gym",
    name,
    description,
    url: canonical,
    telephone: phone || whatsapp,
    email: email || undefined,
    image: ogImage || undefined,
    ...(address || city
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: address || undefined,
            addressLocality: city || undefined,
          },
        }
      : {}),
    ...(hours
      ? {
          openingHours: hours,
        }
      : {}),
  };

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    ${description ? `<meta name="description" content="${escapeAttr(description)}" />` : ""}
    ${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}" />` : ""}
    <meta name="robots" content="index, follow" />
    ${canonical ? `<link rel="canonical" href="${escapeAttr(canonical)}" />` : ""}
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(title)}" />
    ${description ? `<meta property="og:description" content="${escapeAttr(description)}" />` : ""}
    ${canonical ? `<meta property="og:url" content="${escapeAttr(canonical)}" />` : ""}
    ${ogImage ? `<meta property="og:image" content="${escapeAttr(ogImage)}" />` : ""}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(title)}" />
    ${description ? `<meta name="twitter:description" content="${escapeAttr(description)}" />` : ""}
    ${ogImage ? `<meta name="twitter:image" content="${escapeAttr(ogImage)}" />` : ""}
    <meta name="theme-color" content="#6366f1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

function buildFallbackHtml() {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Gimnasio</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

export default async function handler(req, res) {
  const { gymCode } = req.query;

  if (!gymCode) {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(404).end(buildFallbackHtml());
    return;
  }

  try {
    const upstream = await fetch(`${BACKEND_BASE}/api/gyms/public/${encodeURIComponent(gymCode)}/seo/`);
    const body = await upstream.text();

    if (!upstream.ok) {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.status(200).end(buildFallbackHtml());
      return;
    }

    const data = JSON.parse(body);
    const html = buildHtml(data);

    res.setHeader("content-type", "text/html; charset=utf-8");
    res.setHeader("cache-control", "public, max-age=3600, must-revalidate");
    res.status(200).end(html);
  } catch {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.status(200).end(buildFallbackHtml());
  }
}
