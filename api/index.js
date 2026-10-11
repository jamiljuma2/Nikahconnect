import tanstackServer from "../dist/server/server.js";

function getPublicOrigin(req) {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost) return `https://${productionHost}`;

  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  return new URL(`${protocol}://${host}`).origin;
}

function serveSearchResource(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const origin = getPublicOrigin(req);
  let body;
  let contentType;

  if (pathname === "/sitemap.xml") {
    body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`;
    contentType = "application/xml; charset=utf-8";
  } else if (pathname === "/robots.txt") {
    body = `User-agent: *\nAllow: /\nDisallow: /discover\nDisallow: /matches\nDisallow: /likes\nDisallow: /chat/\nDisallow: /settings\nDisallow: /plans\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`;
    contentType = "text/plain; charset=utf-8";
  } else {
    return false;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.end(req.method === "HEAD" ? undefined : body);
  return true;
}

export default async function handler(req, res) {
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers.host ?? "localhost";
  const requestUrl = new URL(req.url ?? "/", `${protocol}://${host}`);
  if (serveSearchResource(req, res, requestUrl.pathname)) return;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (value != null) {
      headers.set(key, value);
    }
  }

  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : undefined;
  }

  const response = await tanstackServer.fetch(
    new Request(requestUrl, { method: req.method, headers, body }),
    process.env,
    {},
  );

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
