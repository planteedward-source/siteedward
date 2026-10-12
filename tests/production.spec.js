import { test, expect } from "@playwright/test";
import { seoPages, siteUrl } from "../src/seo.js";
test("server exposes content and unique metadata without JavaScript", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [path, seo] of Object.entries(seoPages)) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain("Edward Plante");
    expect(html).not.toContain('<div id="root"></div>');
    await page.goto(`http://127.0.0.1:4173${path}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page).toHaveTitle(seo.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      seo.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${siteUrl}${path}`,
    );
    const schema = JSON.parse(
      await page.locator("#structured-data").textContent(),
    );
    expect(schema["@graph"].find((n) => n["@type"] === "Person").name).toBe(
      "Edward Plante",
    );
  }
  await context.close();
});
test("404, admin noindex, HEAD and unsafe methods have correct responses", async ({
  request,
}) => {
  const missing = await request.get("/page-absente");
  expect(missing.status()).toBe(404);
  expect(missing.headers()["x-robots-tag"]).toContain("noindex");
  const admin = await request.get("/admin");
  expect(admin.status()).toBe(200);
  expect(admin.headers()["x-robots-tag"]).toContain("noindex");
  expect(admin.headers()["cache-control"]).toBe("no-store");
  expect(await admin.text()).not.toContain("application/ld+json");
  expect((await request.head("/parcours")).status()).toBe(200);
  expect((await request.post("/contact")).status()).toBe(405);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("/admin");
});
test("HTML hydrates and maintains separate soccer and futsal identities", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".club-line .jersey").first()).toContainText("#77");
  await expect(page.locator(".futsal-club-line .jersey")).toContainText("#40");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Mon parcours", exact: true })
    .click();
  await expect(page).toHaveTitle(seoPages["/parcours"].title);
  await expect(page.locator("h1")).toContainText("Le soccer");
  expect(errors).toEqual([]);
});
