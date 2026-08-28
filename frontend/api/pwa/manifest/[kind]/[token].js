const BACKEND_BASE =
  "https://gim-saas.onrender.com/api/gyms/pwa";

export default async function handler(req, res) {
  const { kind, token } = req.query;

  if (kind !== "member" && kind !== "staff") {
    res.status(404).end("Not found");
    return;
  }

  try {
    const upstream = await fetch(`${BACKEND_BASE}/${kind}/${token}/`);
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader(
      "content-type",
      upstream.headers.get("content-type") || "application/manifest+json",
    );
    res.setHeader("cache-control", "public, max-age=3600, must-revalidate");
    res.end(body);
  } catch (err) {
    res.status(502).end("Bad gateway");
  }
}