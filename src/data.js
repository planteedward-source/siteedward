import { createClient } from "@supabase/supabase-js";
import { initialData } from "./model.js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const configured = Boolean(
  url &&
  key &&
  /^https:\/\/[^/]+\.supabase\.co$/.test(url) &&
  (key.startsWith("sb_publishable_") || key.split(".").length === 3),
);
export const db = configured
  ? createClient(url, key, {
      auth: {
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
        detectSessionInUrl: typeof window !== "undefined",
      },
    })
  : null;
export function mediaUrl(media, thumbnail = false) {
  if (media.id.startsWith("local-"))
    return thumbnail ? media.thumbnail : media.path;
  return db?.storage.from("player-media").getPublicUrl(media.path).data
    .publicUrl;
}
export async function readPublic() {
  if (!db) return structuredClone(initialData);
  const results = await Promise.all([
    db.from("seasons").select("*").order("label", { ascending: false }),
    db.from("totals").select("*"),
    db.from("media").select("*").order("created_at", { ascending: false }),
    db.from("site_settings").select("*").eq("id", 1).single(),
  ]);
  const failure = results.find((r) => r.error);
  if (failure)
    throw new Error(
      "Les données publiées sont temporairement indisponibles. Les dernières données disponibles restent affichées.",
    );
  return {
    seasons: results[0].data,
    totals: results[1].data,
    media: results[2].data,
    settings: results[3].data,
  };
}
export async function verifyAdmin() {
  if (!db) return false;
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return false;
  const { data, error: roleError } = await db.rpc("is_admin");
  if (roleError)
    throw new Error(
      "Impossible de vérifier les droits administrateur. Vérifiez la migration Supabase.",
    );
  return data === true;
}
export async function rpc(name, args) {
  if (!db || !(await verifyAdmin()))
    throw new Error("Un compte administrateur autorisé est nécessaire.");
  const { data, error } = await db.rpc(name, args);
  if (error)
    throw new Error(
      error.message.includes("conflict")
        ? "Ces chiffres ont été modifiés ailleurs. Rechargez les données avant de recommencer."
        : error.message,
    );
  return data;
}
export async function upload(file, title, alt) {
  if (!db || !(await verifyAdmin()))
    throw new Error("Un compte administrateur autorisé est nécessaire.");
  const body = new FormData();
  body.set("file", file);
  body.set("title", title);
  body.set("alt", alt);
  const { data, error } = await db.functions.invoke("upload-media", { body });
  if (error || data?.error)
    throw new Error(
      data?.error ||
        "Importation refusée. Vérifiez la fonction upload-media et réessayez.",
    );
  return data;
}
