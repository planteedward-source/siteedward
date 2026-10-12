# Référencement SEO et GEO

Les cinq pages publiques ont des titres et descriptions distincts, des URL canoniques, des aperçus sociaux et un graphe Schema.org cohérent (Person, ProfilePage, WebSite et BreadcrumbList). Le profil utilise uniquement les informations fournies. Aucun téléphone, date de naissance, résultat, récompense ou réseau social n'a été inventé.

## Lecture par les moteurs et assistants

Le rendu préparé pour Vercel transmet un HTML complet via `api/site.js`, même sans JavaScript. Le navigateur hydrate ensuite le même contenu. Les données publiques Supabase sont lues à chaque rendu serveur, avec un cache partagé de 30 secondes et une revalidation de 30 secondes ; le navigateur continue à actualiser les chiffres comme avant. Aucun compte, session ou droit administrateur n'est inclus dans le HTML initial. Sans Supabase, les données locales sont utilisées. En cas d'indisponibilité de Supabase configuré, le serveur répond temporairement 503 plutôt que d'indexer les chiffres de secours comme s'ils étaient à jour.

Les URL inexistantes renvoient une vraie réponse 404. L'administration utilise `noindex, nofollow` dans le HTML et dans l'en-tête HTTP, sans cache. Elle n'apparaît pas dans le sitemap. `robots.txt` autorise sa lecture pour que les moteurs puissent constater le noindex ; l'authentification et les droits restent protégés côté serveur.

Les informations clés sont en texte, les images disposent de textes alternatifs et les pages sont liées entre elles. Aucun fichier « magique » ou bourrage de mots-clés n'est nécessaire pour les réponses IA. Ces changements suivent les [fondamentaux Google pour les fonctionnalités IA](https://developers.google.com/search/docs/appearance/ai-features) et les [recommandations JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). L'indexation et le classement restent à la discrétion des moteurs.

## Vérifier en local

```sh
npm run build
npm run preview
```

Ouvrir http://127.0.0.1:4173. Cet aperçu utilise le même gestionnaire de rendu que Vercel. Le serveur de développement à http://127.0.0.1:5173 utilise toujours Vite pour les modifications rapides. Les tests navigateur incluent la lecture des cinq pages sans JavaScript, les métadonnées, les codes HTTP, l'hydratation et la séparation #77 soccer / #40 futsal.

## Après déploiement sur le projet Vercel existant

1. Vérifier que la fonction `api/site.js` est déployée et que `/parcours`, `/statistiques`, `/medias` et `/contact` répondent 200 avec le bon contenu dans le code source HTML. Ne pas déployer uniquement `dist` sur un hébergement statique : le rendu SEO utilise la fonction Vercel.
2. Vérifier la propriété `https://edward-plante.vercel.app/` dans Google Search Console, puis soumettre `https://edward-plante.vercel.app/sitemap.xml`. Inspecter l'accueil et le parcours et demander leur indexation. Ces étapes nécessitent le compte du propriétaire ; elles n'ont pas été effectuées.
3. Contrôler le profil structuré avec le validateur Schema.org et le HTML rendu avec l'inspection d'URL Google. Le balisage ne garantit pas un résultat enrichi.
4. Partager le lien du site dans les échanges avec les recruteurs et demander, lorsque c'est approprié, un lien depuis une page officielle réelle de votre club ou de votre équipe. Les mentions légitimes permettent aux recruteurs de retrouver et d'identifier le même joueur.
5. Maintenir les informations et les médias à jour. Ajouter de vraies vidéos lorsque disponibles ; ne pas publier de clips ou de résultats fictifs pour remplir le site.

Le domaine personnalisé sera traité plus tard : mettre à jour `siteUrl` dans `src/seo.js`, les valeurs par défaut dans `index.html`, `sitemap.xml`, `robots.txt`, les origines Supabase et les redirections du domaine précédent. Aucun déploiement ou indexation publique n'a été annoncé comme réalisé pendant cette passe.
