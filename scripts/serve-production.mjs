import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";
import handler from "../api/site.js";
const root = resolve("dist");
const types = {
  js: "text/javascript",
  css: "text/css",
  png: "image/png",
  jpg: "image/jpeg",
  mp4: "video/mp4",
  webp: "image/webp",
  svg: "image/svg+xml",
  woff2: "font/woff2",
  txt: "text/plain",
  xml: "application/xml",
};
createServer(async (req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://local").pathname);
  } catch {
    res.statusCode = 400;
    return res.end();
  }
  const target = resolve(root, `.${pathname}`);
  if (target.startsWith(root + sep) && !pathname.startsWith("/server/")) {
    try {
      if ((await stat(target)).isFile()) {
        res.setHeader(
          "Content-Type",
          types[target.split(".").at(-1)] || "application/octet-stream",
        );
        const bytes = await readFile(target);
        res.setHeader("Accept-Ranges", "bytes");
        const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
        if (range) {
          const start = Number(range[1]);
          const end = Math.min(range[2] ? Number(range[2]) : bytes.length - 1, bytes.length - 1);
          if (start > end) { res.statusCode = 416; return res.end(); }
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
          res.setHeader("Content-Length", end - start + 1);
          return res.end(req.method === "HEAD" ? undefined : bytes.subarray(start, end + 1));
        }
        res.setHeader("Content-Length", bytes.length);
        return res.end(req.method === "HEAD" ? undefined : bytes);
      }
    } catch {}
  }
  await handler(req, res);
}).listen(4173, "127.0.0.1", () =>
  console.log("Production preview: http://127.0.0.1:4173"),
);
