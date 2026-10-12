import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("public pages: images, mobile layout, accessibility and private controls", async ({
  page,
}, info) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/parcours",
    "/statistiques",
    "/medias",
    "/contact",
    "/admin",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const img of await page.locator("img:visible").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0))
        .toBe(true);
    }
    expect(
      await page.locator(".stepper, .upload-form, .season-form").count(),
    ).toBe(0);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  }
  await expect(
    page.getByText("L’administration reste à configurer."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toHaveCount(
    0,
  );
  await page.goto("/");
  await expect(page.locator(".hero-photo")).toHaveAttribute(
    "src",
    "/images/accueil.png",
  );
  await expect(page.locator(".home-totals .stat strong")).toHaveText([
    "0",
    "0",
  ]);
  await page.screenshot({
    path: `test-results/${info.project.name}-accueil.png`,
    fullPage: true,
  });
  await page.goto("/statistiques");
  await expect(page.locator(".stats-grid .stat strong")).toHaveText([
    "0",
    "0",
    "0",
    "0",
    "0",
    "0",
  ]);
  await page.screenshot({
    path: `test-results/${info.project.name}-statistiques.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("menu links always return to top; section links retain their target", async ({
  page,
}, info) => {
  await page.goto("/");
  for (const [label, path] of [
    ["Mon parcours", "/parcours"],
    ["Statistiques", "/statistiques"],
    ["Médias", "/medias"],
    ["Contact", "/contact"],
    ["Accueil", "/"],
  ]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      if (info.project.name !== "desktop")
        await page.getByRole("button", { name: "Ouvrir le menu" }).click();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(page).toHaveURL(
        new RegExp(`${path === "/" ? "/$" : path + "$"}`),
      );
      await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
    }
  }
  await page.goto("/#chiffres");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect(page.locator("#chiffres")).toBeInViewport();
});

test("gallery modal, reference videos and email work without a public phone", async ({
  page,
}) => {
  await page.goto("/medias");
  const photo = page.getByRole("button", {
    name: "Ouvrir : Sur le terrain avec JM",
  });
  await photo.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(photo).toBeFocused();
  await page.getByRole("button", { name: "Vidéos", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Saison dernière · U13 AAA" })).toBeVisible();
  await expect(page.locator(".reference-grid video")).toHaveCount(3);
  for (const video of await page.locator(".reference-grid video").all()) {
    await video.evaluate(async (el) => { el.muted = true; await el.play(); });
    await expect.poll(() => video.evaluate((el) => el.currentTime)).toBeGreaterThan(0);
    await video.evaluate((el) => el.pause());
  }
  await page.goto("/contact");
  await expect(
    page.locator('a[href="mailto:planteedward@gmail.com"]'),
  ).toBeVisible();
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
});
