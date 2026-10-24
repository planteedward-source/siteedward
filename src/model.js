export const teams = [
  {
    id: "trident",
    name: "CS Trident",
    initials: "C",
    sport: "Soccer",
    detail: "AA · Numéro 77",
  },
  {
    id: "jm",
    name: "JM Bleu & Or",
    initials: "JM",
    sport: "Futsal scolaire",
    detail: "Équipe scolaire",
  },
];
export const localMedia = [
  {
    id: "local-hero",
    kind: "image",
    path: "/images/soccer-bleu.png",
    title: "Sur le terrain",
    alt: "Edward en maillot bleu clair numéro 77 près du ballon.",
  },
  {
    id: "local-1",
    kind: "image",
    path: "/images/action-jm.png",
    title: "En action",
    alt: "Edward, numéro 40 en bleu, frappe le ballon sur un terrain extérieur.",
  },
  {
    id: "local-2",
    kind: "image",
    path: "/images/jm-terrain.png",
    title: "Avec les joueurs de JM",
    alt: "Edward avec le maillot numéro 40 aux côtés de joueurs de JM.",
  },
  {
    id: "local-3",
    kind: "image",
    path: "/images/soccer-77.png",
    title: "Soccer · Numéro 77",
    alt: "Edward de dos en maillot noir numéro 77 sur le terrain.",
  },
  {
    id: "local-4",
    kind: "image",
    path: "/images/accueil.png",
    title: "Sur le terrain avec JM",
    alt: "Edward de dos avec le maillot bleu JM numéro 40 sur un terrain extérieur.",
  },
  {
    id: "local-5",
    kind: "image",
    path: "/images/soccer-frappe.png",
    title: "Une frappe au soccer",
    alt: "Edward en maillot bleu clair numéro 77 frappe le ballon.",
  },
].map((media) => ({
  ...media,
  thumbnail: media.path.replace(".png", "-thumb.webp"),
}));
localMedia.push(...[1, 2, 3].map((number) => ({
  id: `local-video-${number}`,
  kind: "video",
  collection: "previous-u13-aaa",
  path: `/videos/reference-u13-aaa-${number}.mp4`,
  poster: `/videos/reference-u13-aaa-${number}.jpg`,
  title: `U13 AAA · Vidéo ${number}`,
  alt: `Extrait ${number} de la saison dernière d’Edward Plante en U13 AAA.`,
})));
export const initialData = {
  seasons: [{ id: "2026-2027", label: "2026-2027", active: true }],
  totals: teams.map((t) => ({
    season_id: "2026-2027",
    team: t.id,
    matches: t.id === "trident" ? 2 : 0,
    goals: 0,
    assists: t.id === "trident" ? 2 : 0,
    revision: 0,
  })),
  media: [],
  settings: { hero_media_id: null, hidden_local_media: [] },
};
export function totalFor(data, season, team) {
  return (
    data.totals.find(
      (row) => row.season_id === season && row.team === team,
    ) ?? {
      season_id: season,
      team,
      matches: 0,
      goals: 0,
      assists: 0,
      revision: 0,
    }
  );
}
export function activeSeason(data) {
  return (
    data.seasons.find((s) => s.active) ??
    data.seasons[0] ??
    initialData.seasons[0]
  );
}
export function count(value) {
  const n = Number(value);
  if (value === "" || !Number.isInteger(n) || n < 0 || n > 10000)
    throw new Error("Entrez un nombre entier entre 0 et 10 000.");
  return n;
}
export function validateFile(file, hero = false) {
  const images = ["image/jpeg", "image/png", "image/webp"];
  if (
    ![...images, ...(hero ? [] : ["video/mp4", "video/webm"])].includes(
      file.type,
    )
  )
    throw new Error(
      hero
        ? "Choisissez une photo JPG, PNG ou WebP."
        : "Formats acceptés : JPG, PNG, WebP, MP4 et WebM.",
    );
  const max = file.type.startsWith("image/")
    ? 8 * 1024 * 1024
    : 50 * 1024 * 1024;
  if (!file.size || file.size > max)
    throw new Error("Taille maximale : 8 Mo par photo, 50 Mo par vidéo.");
}
