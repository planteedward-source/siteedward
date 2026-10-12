// UI integration fixtures only; no real Supabase data or credentials are used.
import { test, expect } from "@playwright/test";
import { initialData } from "../src/model.js";

async function mockSupabase(page, options = {}) {
  const data = structuredClone(initialData);
  const state = { denySave: false, admin: options.admin !== false };
  const user = {
    id: "00000000-0000-4000-8000-000000000077",
    aud: "authenticated",
    role: "authenticated",
    email: "admin@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-10-12T00:00:00Z",
  };
  const encoded = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`;
  await page.route("https://fixture.supabase.co/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (path === "/auth/v1/token")
      return json({
        access_token: token,
        refresh_token: "fixture-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (path === "/auth/v1/user") return json(user);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/seasons") return json(data.seasons);
    if (path === "/rest/v1/totals") return json(data.totals);
    if (path === "/rest/v1/media") return json(data.media);
    if (path === "/rest/v1/site_settings") return json(data.settings);
    if (path === "/rest/v1/rpc/is_admin") return json(state.admin);
    if (path === "/functions/v1/upload-media") {
      const id = "00000000-0000-4000-8000-000000000099";
      data.media.push({
        id,
        kind: "video",
        path: "fixture/video.mp4",
        title: "Vidéo de test",
        alt: "Description de test",
      });
      return json({ id });
    }
    if (path === "/rest/v1/rpc/save_totals") {
      if (state.denySave)
        return json(
          { message: "Sauvegarde refusée pour ce test", code: "42501" },
          403,
        );
      const args = req.postDataJSON();
      const row = data.totals.find(
        (r) => r.team === args.p_team && r.season_id === args.p_season,
      );
      row.matches = args.p_matches;
      row.goals = args.p_goals;
      row.assists = args.p_assists;
      row.revision++;
      return json(null);
    }
    if (path === "/rest/v1/rpc/choose_hero") {
      data.settings.hero_media_id = req.postDataJSON().p_media;
      return json(null);
    }
    return json({ message: `Unexpected fixture request: ${path}` }, 500);
  });
  return { data, state };
}
async function login(page) {
  await page.goto("/admin");
  await page.getByLabel("Courriel", { exact: true }).fill("admin@example.test");
  await page.getByLabel("Mot de passe").fill("fixture-password");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
}

test("admin publishes shared totals; failed saves never show confirmation", async ({
  page,
}) => {
  const { data, state } = await mockSupabase(page);
  await login(page);
  await expect(
    page.getByText("Vous êtes connecté au compte administrateur."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Modifier les chiffres" }).click();
  const trident = page.locator(".stats-team.trident");
  await trident.getByLabel("Buts", { exact: true }).fill("5");
  await trident
    .getByRole("button", { name: "Augmenter : Passes décisives", exact: true })
    .click();
  await trident.getByRole("button", { name: "Publier les chiffres" }).click();
  await expect(
    trident.getByText("Chiffres enregistrés et publiés."),
  ).toBeVisible();
  await expect(trident.locator(".stats-grid .stat strong")).toHaveText([
    "0",
    "5",
    "1",
  ]);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Accueil", exact: true })
    .click();
  await expect(page.locator(".home-totals .stat strong")).toHaveText([
    "5",
    "1",
  ]);
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Statistiques", exact: true })
    .click();
  state.denySave = true;
  await trident.getByLabel("Buts", { exact: true }).fill("8");
  await trident.getByRole("button", { name: "Publier les chiffres" }).click();
  await expect(trident.getByRole("alert")).toContainText("Sauvegarde refusée");
  await expect(
    trident.getByText("Chiffres enregistrés et publiés."),
  ).toHaveCount(0);
  expect(data.totals[0].goals).toBe(5);
});

test("admin selects a photo; public page resolves the published selection", async ({
  page,
}) => {
  await mockSupabase(page);
  await login(page);
  await page
    .getByRole("link", { name: "Gérer les médias et la photo" })
    .click();
  await page.locator("summary").click();
  const row = page
    .locator(".media-admin-list > div")
    .filter({ hasText: "En action" });
  await row.getByRole("button", { name: "Choisir pour l’accueil" }).click();
  await expect(page.getByText("Photo d’accueil publiée.")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Accueil", exact: true })
    .click();
  await expect(page.locator(".hero-photo")).toHaveAttribute(
    "src",
    "/images/action-jm.png",
  );
});

test("non-administrator account is rejected and receives no editing controls", async ({
  page,
}) => {
  await mockSupabase(page, { admin: false });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Ce compte ne possède pas les droits administrateur.",
  );
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Statistiques", exact: true })
    .click();
  await expect(page.locator(".stepper")).toHaveCount(0);
});

test("private video import publishes a media that remains visible after logout", async ({
  page,
}) => {
  await mockSupabase(page);
  await login(page);
  await page
    .getByRole("link", { name: "Gérer les médias et la photo" })
    .click();
  await page.getByRole("button", { name: "Ajouter une vidéo" }).click();
  await expect(
    page.getByRole("heading", { name: "Importer une vidéo" }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveAttribute(
    "accept",
    "video/mp4,video/webm",
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "video-test.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from("fixture test only"),
    });
  await page.getByLabel("Titre", { exact: true }).fill("Vidéo de test");
  await page
    .getByLabel("Description pour l’accessibilité")
    .fill("Description de test");
  await page.getByRole("button", { name: "Importer et publier" }).click();
  await expect(page.getByText("Média importé et publié.")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Médias", exact: true })
    .click();
  await page.getByRole("button", { name: "Vidéos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ouvrir : Vidéo de test" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Médias", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Ajouter une vidéo" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Ouvrir : Vidéo de test" }),
  ).toBeVisible();
});
