import { createClient } from "npm:@supabase/supabase-js@2";

const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
function matches(bytes: Uint8Array, mime: string) {
  const at = (offset: number, sequence: number[]) =>
    sequence.every((v, i) => bytes[offset + i] === v);
  const ascii = (offset: number, text: string) =>
    at(
      offset,
      Array.from(text).map((c) => c.charCodeAt(0)),
    );
  if (mime === "image/png") return at(0, [137, 80, 78, 71, 13, 10, 26, 10]);
  if (mime === "image/jpeg") return at(0, [255, 216, 255]);
  if (mime === "image/webp") return ascii(0, "RIFF") && ascii(8, "WEBP");
  if (mime === "video/webm") return at(0, [26, 69, 223, 163]);
  if (mime === "video/mp4")
    return (
      ascii(4, "ftyp") &&
      ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "MSNV"].some((brand) =>
        ascii(8, brand),
      )
    );
  return false;
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const allowed = (
    Deno.env.get("ALLOWED_ORIGINS") ||
    "https://edward-plante.vercel.app,http://127.0.0.1:5173,http://localhost:5173"
  )
    .split(",")
    .map((s) => s.trim());
  const cors = {
    "Access-Control-Allow-Origin": allowed.includes(origin)
      ? origin
      : allowed[0],
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  if (origin && !allowed.includes(origin))
    return json({ error: "Origine non autorisée." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { headers: cors, status: 204 });
  if (req.method !== "POST")
    return json({ error: "Méthode non autorisée." }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return json({ error: "Connexion requise." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user)
      return json({ error: "Connexion expirée ou invalide." }, 401);
    const { data: isAdmin, error: roleError } = await client.rpc("is_admin");
    if (roleError || isAdmin !== true)
      return json({ error: "Compte administrateur requis." }, 403);
    if (Number(req.headers.get("Content-Length") || 0) > 53 * 1024 * 1024)
      return json({ error: "Fichier trop volumineux." }, 413);
    if (!req.headers.get("Content-Type")?.startsWith("multipart/form-data"))
      return json({ error: "Importation invalide." }, 400);
    const body = await req.formData();
    const file = body.get("file");
    const title = String(body.get("title") || "").trim();
    const alt = String(body.get("alt") || "").trim();
    if (
      !(file instanceof File) ||
      !mimeExtensions[file.type] ||
      !title ||
      title.length > 120 ||
      !alt ||
      alt.length > 500
    )
      return json({ error: "Format, titre ou description invalide." }, 400);
    const image = file.type.startsWith("image/");
    const limit = (image ? 8 : 50) * 1024 * 1024;
    if (!file.size || file.size > limit)
      return json(
        { error: "Maximum : 8 Mo par photo ou 50 Mo par vidéo." },
        413,
      );
    const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    if (!matches(header, file.type))
      return json(
        { error: "Le contenu du fichier ne correspond pas au format annoncé." },
        400,
      );
    // This secret is injected by Supabase, never sent to the browser or committed.
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}.${mimeExtensions[file.type]}`;
    const { error: storageError } = await service.storage
      .from("player-media")
      .upload(path, file, {
        contentType: file.type,
        upsert: false,
        cacheControl: "31536000",
      });
    if (storageError)
      return json({ error: "Le fichier n’a pas pu être enregistré." }, 500);
    const { error: insertError } = await service
      .from("media")
      .insert({ id, path, kind: image ? "image" : "video", title, alt });
    if (insertError) {
      await service.storage.from("player-media").remove([path]);
      return json({ error: "Publication impossible. Réessayez." }, 500);
    }
    return json({ id });
  } catch {
    return json(
      { error: "Importation interrompue. Aucun succès ne peut être confirmé." },
      500,
    );
  }
});
