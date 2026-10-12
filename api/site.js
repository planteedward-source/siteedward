import React from "react";
import { renderToString } from "react-dom/server";
import "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  seoFor,
  seoPages,
  robotsFor,
  structuredData,
  safeJson,
  siteUrl,
} from "../src/seo.js";
import { initialData, localMedia } from "../src/model.js";
let bundle;
function escape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
export default async function handler(req, res) {
  const url = new URL(req.url, "http://local");
  const path =
    String(
      req.query?.page || url.searchParams.get("page") || url.pathname,
    ).replace(/\/$/, "") || "/";
  const known = Boolean(seoPages[path]) || path === "/admin";
  if (!["GET", "HEAD"].includes(req.method)) {
    res.setHeader("Allow", "GET, HEAD");
    res.statusCode = 405;
    return res.end();
  }
  try {
    bundle ||= import(
      pathToFileURL(join(process.cwd(), "dist/server/app.mjs")).href
    );
    const { default: App, readPublic } = await bundle;
    let data;
    let unavailable = false;
    try {
      data = await readPublic();
    } catch {
      data = structuredClone(initialData);
      unavailable = true;
    }
    const template = await readFile(
      join(process.cwd(), "dist/server/template.html"),
      "utf8",
    );
    const page = seoFor(path);
    const hero = [...data.media, ...localMedia].find(
      (m) => m.id === data.settings.hero_media_id && m.kind === "image",
    );
    const publicUrl = process.env.VITE_SUPABASE_URL;
    const image = hero?.id.startsWith("local-")
      ? `${siteUrl}${hero.path}`
      : hero && publicUrl
        ? `${publicUrl}/storage/v1/object/public/player-media/${hero.path}`
        : `${siteUrl}/images/accueil.png`;
    const graph = structuredData(path, image);
    let html = template.replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escape(page.title)}</title>`,
    );
    for (const [attribute, name, value] of [
      ["name", "description", page.description],
      ["name", "robots", robotsFor(path)],
      ["property", "og:title", page.title],
      ["property", "og:description", page.description],
      ["property", "og:url", `${siteUrl}${path}`],
      ["property", "og:image", image],
      ["name", "twitter:image", image],
      ["name", "twitter:title", page.title],
      ["name", "twitter:description", page.description],
    ]) {
      html = html.replace(
        new RegExp(`<meta\\s+${attribute}="${name}"\\s+content="[^"]*"\\s*/?>`),
        `<meta ${attribute}="${name}" content="${escape(value)}" />`,
      );
    }
    html = html.replace(
      /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${siteUrl}${escape(path)}" />`,
    );
    if (graph)
      html = html.replace(
        "</head>",
        `<script id="structured-data" type="application/ld+json">${safeJson(graph)}</script></head>`,
      );
    const content = renderToString(
      React.createElement(App, { initialPath: path, initialPublicData: data }),
    );
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${content}</div><script id="public-data" type="application/json">${safeJson(data)}</script>`,
    );
    res.statusCode = known ? 200 : 404;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("X-Robots-Tag", robotsFor(path));
    res.setHeader(
      "Cache-Control",
      known && path !== "/admin" && !unavailable
        ? "public, s-maxage=30, stale-while-revalidate=30"
        : "no-store",
    );
    if (unavailable) {
      res.statusCode = 503;
      res.setHeader("Retry-After", "60");
    }
    res.end(req.method === "HEAD" ? undefined : html);
  } catch {
    res.statusCode = 503;
    res.setHeader("Retry-After", "60");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      "Le site est temporairement indisponible. Réessayez dans un instant.",
    );
  }
}
