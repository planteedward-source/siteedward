export const siteUrl = "https://edward-plante.vercel.app";
export const seoPages = {
  "/": {
    label: "Accueil",
    title: "Edward Plante | Ailier gauche CS Trident AA · Québec",
    description:
      "Profil d’Edward Plante, 13 ans : ailier gauche au CS Trident AA, numéro 77, et futsal scolaire JM Bleu & Or. Parcours, statistiques, médias et contact.",
    type: "ProfilePage",
  },
  "/parcours": {
    label: "Mon parcours",
    title: "Parcours d’Edward Plante | Soccer AA et futsal scolaire",
    description:
      "Edward Plante joue depuis l’âge de 6 ans. Ailier gauche droitier au CS Trident AA et joueur de futsal scolaire JM Bleu & Or, avec un objectif de retour en AAA.",
    type: "ProfilePage",
  },
  "/statistiques": {
    label: "Statistiques",
    title: "Statistiques Edward Plante | CS Trident et JM Bleu & Or",
    description:
      "Matchs joués, buts et passes décisives d’Edward Plante par saison, séparés entre CS Trident en soccer AA et JM Bleu & Or en futsal scolaire.",
    type: "WebPage",
  },
  "/medias": {
    label: "Médias",
    title: "Photos et vidéos Edward Plante | Soccer et futsal au Québec",
    description:
      "Photos et vidéos publiées d’Edward Plante sur le terrain. Découvrez ses médias de soccer et de futsal, puis consultez son parcours et ses statistiques.",
    type: "CollectionPage",
  },
  "/contact": {
    label: "Contact",
    title: "Contacter Edward Plante | Recrutement soccer et futsal",
    description:
      "Joindre Edward Plante par courriel pour une question sur son parcours au CS Trident AA, son futsal scolaire avec JM Bleu & Or ou une occasion de jouer.",
    type: "ContactPage",
  },
};
export function seoFor(path) {
  return (
    seoPages[path] || {
      label: path === "/admin" ? "Administration" : "Page introuvable",
      title: `${path === "/admin" ? "Administration" : "Page introuvable"} — Edward Plante`,
      description: "Site personnel d’Edward Plante.",
      type: "WebPage",
    }
  );
}
export function robotsFor(path) {
  return seoPages[path]
    ? "index, follow, max-image-preview:large"
    : "noindex, nofollow";
}
export function structuredData(path, image = `${siteUrl}/images/accueil.png`) {
  if (!seoPages[path]) return null;
  const page = seoFor(path);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "Edward Plante — Soccer & futsal",
        url: `${siteUrl}/`,
        inLanguage: "fr-CA",
        publisher: { "@id": `${siteUrl}/#edward-plante` },
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#edward-plante`,
        name: "Edward Plante",
        givenName: "Edward",
        familyName: "Plante",
        url: `${siteUrl}/parcours`,
        image,
        description:
          "Edward Plante, 13 ans, au Québec. Ailier gauche, pied droit, CS Trident AA, numéro 77. Futsal scolaire avec JM Bleu & Or. Joue depuis l’âge de 6 ans et vise un retour en AAA la saison prochaine.",
        homeLocation: { "@type": "Place", name: "Québec" },
        memberOf: [
          {
            "@type": "SportsTeam",
            name: "CS Trident",
            sport: "Soccer",
            description: "Niveau AA",
          },
          {
            "@type": "SportsTeam",
            name: "JM Bleu & Or",
            sport: "Futsal",
            description: "Futsal scolaire",
          },
        ],
        ...(path === "/contact" ? { email: "planteedward@gmail.com" } : {}),
      },
      {
        "@type": page.type,
        "@id": `${siteUrl}${path}#page`,
        url: `${siteUrl}${path}`,
        name: page.title,
        description: page.description,
        inLanguage: "fr-CA",
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@id": `${siteUrl}/#edward-plante` },
        ...(page.type === "ProfilePage"
          ? { mainEntity: { "@id": `${siteUrl}/#edward-plante` } }
          : {}),
        ...(path !== "/"
          ? { breadcrumb: { "@id": `${siteUrl}${path}#breadcrumb` } }
          : {}),
      },
      ...(path !== "/"
        ? [
            {
              "@type": "BreadcrumbList",
              "@id": `${siteUrl}${path}#breadcrumb`,
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Accueil",
                  item: `${siteUrl}/`,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: page.label,
                  item: `${siteUrl}${path}`,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
export function updateSeo(path, image = `${siteUrl}/images/accueil.png`) {
  const page = seoFor(path);
  document.title = page.title;
  for (const [selector, value] of [
    ['meta[name="description"]', page.description],
    ['meta[property="og:title"]', page.title],
    ['meta[property="og:description"]', page.description],
    ['meta[property="og:url"]', `${siteUrl}${path}`],
    ['meta[property="og:image"]', image],
    ['meta[name="twitter:image"]', image],
    ['meta[name="twitter:title"]', page.title],
    ['meta[name="twitter:description"]', page.description],
    ['meta[name="robots"]', robotsFor(path)],
  ]) {
    const element = document.querySelector(selector);
    if (element) element.content = value;
  }
  document.querySelector('link[rel="canonical"]').href = `${siteUrl}${path}`;
  let schema = document.getElementById("structured-data");
  const graph = structuredData(path, image);
  if (graph) {
    if (!schema) {
      schema = document.createElement("script");
      schema.id = "structured-data";
      schema.type = "application/ld+json";
      document.head.appendChild(schema);
    }
    schema.textContent = safeJson(graph);
  } else schema?.remove();
}
