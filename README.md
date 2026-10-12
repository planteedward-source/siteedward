# Edward Plante — siteedward

Site React/Vite en français, avec rendu HTML côté serveur sur Vercel pour le référencement. Voir `SEO.md` pour les modifications SEO/GEO et les vérifications après déploiement. Le dépôt GitHub était vide lors de son inspection le 12 octobre 2026. Aucune configuration Vercel ou Supabase existante n'était présente. SoccerApp n'a pas été modifiée.

## Ouvrir en local

Node.js 22.12+ ou 24, puis dans ce dossier :

```sh
npm install
npm run dev
```

Ouvrir http://127.0.0.1:5173. Sans variables Supabase, les cinq pages publiques utilisent les informations initiales, des totaux à 0 et six photos réellement fournies. La photo d'accueil est la copie exacte de `Capture d’écran 2026-10-12 132200.png`, sans retouche. Le joueur porte le numéro 40 sur cette photo ; son numéro de soccer 77 est affiché séparément. Les photos demeurent originales : aucune image générée.

Les commandes `npm test` et `npm run build` vérifient les règles locales et produisent `dist/`. `npm run test:browser` utilise Chrome installé pour vérifier trois tailles d'écran, la navigation, les médias, l'accessibilité et les parcours administrateur avec des réponses Supabase simulées uniquement dans les tests. Les règles SQL de production sont aussi exécutées dans PostgreSQL via PGlite : visiteurs, comptes ordinaires, administrateur, contraintes et conflits. Cela ne remplace pas une vérification de la fonction Edge déployée sur votre vrai projet. L'administration est accessible à `/admin`, via « Espace privé » en bas de page.

La galerie utilise des copies WebP légères ; l'accueil et l'affichage agrandi utilisent les PNG originaux. La police Inter est locale avec sa licence dans `public/fonts/`. Aucun service externe n'est nécessaire pour les photos ou la typographie.

## Activer l'administration Supabase

Utiliser un projet Supabase dédié à ce site pour éviter d'affecter SoccerApp.

1. Exécuter les fichiers SQL de `supabase/migrations/` dans leur ordre numérique, une fois chacun dans le SQL Editor. Ou utiliser les migrations Supabase CLI sur un nouveau projet lié.
2. Créer votre utilisateur courriel/mot de passe depuis Authentication > Users ; désactiver les inscriptions publiques. Utiliser un mot de passe unique et fort. Le courriel public n'accorde aucun droit par lui-même.
3. Copier son UUID, puis autoriser ce compte dans le SQL Editor :

```sql
insert into private.site_admins(user_id) values ('UUID-DU-COMPTE');
```

4. Copier `.env.example` en `.env.local`. Ajouter l'URL du projet et **uniquement sa clé publishable** (ou sa clé anon historique). Ne jamais ajouter de secret/service_role à une variable VITE_. Les fichiers `.env` sont ignorés par Git.
5. Déployer la fonction d'importation avec Supabase CLI :

```sh
supabase login
supabase link --project-ref REFERENCE-DU-PROJET
supabase functions deploy upload-media
```

6. La fonction accepte par défaut `https://edward-plante.vercel.app`, `http://127.0.0.1:5173` et `http://localhost:5173`. Pour un autre domaine ou aperçu Vercel, définir le secret `ALLOWED_ORIGINS` dans Supabase avec la liste exacte séparée par des virgules. Aucun joker. Les secrets SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis côté serveur par Supabase.
7. Redémarrer le serveur local, ou reconstruire/redéployer Vercel après ajout des deux variables publiques.

### Protection des données

Les tables publiques ont RLS et n'accordent que la lecture aux navigateurs. Les mutations passent par des fonctions SQL qui contrôlent `auth.uid()` contre une liste privée d'administrateurs, y compris lorsque l'appel est fait sans l'interface. Un compte authentifié ordinaire n'a aucun droit d'écriture. Aucun droit ne repose sur une adresse courriel, le stockage local ou la visibilité des boutons. Les compteurs sont validés par contraintes SQL et protégés des écrasements concurrents par une révision. Aucune table de faux matchs.

La fonction Edge vérifie le JWT auprès de Supabase Auth, puis les droits en base, avant de valider format, signature binaire, taille, titre et texte alternatif. JPG/PNG/WebP : 8 Mo ; MP4/WebM : 50 Mo. Les noms de fichiers sont générés côté serveur ; SVG/HTML et URL externes ne sont pas acceptés. Aucun droit d'écriture Storage n'est accordé aux navigateurs. Le bucket de médias est public car les médias sont destinés au site public.

La vérification JWT de la passerelle est désactivée dans `config.toml` pour prendre en charge les clés de signature actuelles ; la fonction authentifie elle-même chaque requête via `getUser(token)` puis vérifie le rôle en base avant tout accès privilégié. Voir la [documentation Supabase](https://supabase.com/docs/guides/troubleshooting/edge-function-401-error-response). Le gestionnaire Edge lui-même est exécuté dans les tests, avec des réponses Auth/Storage contrôlées : refus des visiteurs et comptes ordinaires, validation des octets, publication et nettoyage après erreur.

« Retirer » masque une photo locale ou supprime la publication d'un média importé dans la galerie. Les fichiers importés retirés restent dans Storage pour éviter une perte irréversible ; leur URL publique reste accessible. Pour une suppression physique, supprimer aussi l'objet dans le tableau de bord Storage Supabase. Les photos locales sont suivies dans Git : les retirer de la galerie ne les efface pas du dépôt. La photo d'accueil ne peut pas être retirée avant d'en choisir une autre.

Les statistiques de l'accueil et de la page Statistiques viennent de la même table. Après sauvegarde, elles sont rechargées. Les autres visiteurs actualisent les données au retour sur l'onglet et toutes les 30 secondes lorsque l'onglet est visible. Sans réseau, un avertissement est affiché ; une erreur n'est jamais présentée comme une sauvegarde réussie. Une importation réussie suivie d'un échec de sélection d'accueil peut laisser le média dans la galerie : le choisir ensuite depuis les médias.

## Vercel

Les fichiers préparés sont dans ce checkout local ; ils n'ont pas été envoyés à GitHub et aucun déploiement n'a été effectué. Pour les publier dans le dépôt existant, après avoir vérifié les paramètres ci-dessous :

```sh
git add .
git commit -m "Créer le portfolio soccer et futsal d'Edward Plante"
git push origin main
```

Un push peut déclencher le déploiement automatique si le dépôt est déjà lié à Vercel.

Dans le **projet Vercel existant** lié à `edward-plante.vercel.app`, vérifier que le dépôt associé est `planteedward-source/siteedward`. Ne pas toucher au projet SoccerApp. Définir le répertoire racine du dépôt sur sa racine (`./`), framework Vite, build `npm run build`, sortie `dist`. `vercel.json` contient les réécritures et les en-têtes de sécurité. Ajouter les deux variables VITE_ si Supabase doit être actif.

Un déploiement public ne doit être annoncé qu'après vérification du résultat Vercel. Le dépôt vide ne permettait pas de déterminer le lien du projet Vercel actuel. Les métadonnées pointent vers l'adresse fournie. Le futur domaine nécessitera de mettre à jour canonical/OG, sitemap, robots, URL du site Supabase et ALLOWED_ORIGINS.

## Vérifications avec une vraie configuration

La compilation et les vérifications locales ne remplacent pas les essais Supabase. Après configuration :

- Avec votre compte autorisé, publier des chiffres sur chaque équipe et vérifier accueil + statistiques, puis ouvrir dans un second navigateur non connecté. Remettre les vrais chiffres après l'essai.
- Créer une saison, l'activer et vérifier que l'accueil change de saison. La saison active ne peut pas être supprimée.
- Importer une photo puis la sélectionner pour l'accueil. Vérifier depuis un autre navigateur. Essayer un fichier au format interdit et un fichier trop volumineux.
- Essayer les RPC de modification avec la clé publique sans JWT, puis avec un compte authentifié non administrateur : les deux doivent être refusés. Les écritures REST directes et Storage doivent aussi être refusées.
- Le fichier `supabase/tests/access.sql` fournit un test transactionnel des autorisations côté base. Il peut être exécuté dans le SQL Editor après la migration et n'ajoute aucune donnée permanente.

La date de naissance, les mensurations, les récompenses et les résultats sportifs n'ont pas été inventés. L'âge est une information explicite à mettre à jour manuellement dans le code lorsqu'il change.

Les trois vidéos de référence sont des extraits de la saison dernière en U13 AAA, selon Edward. Les copies MP4 optimisées et leurs affiches se trouvent dans `public/videos/`. Les fichiers MOV originaux restent intacts. La migration 002 permet à l’administrateur de retirer ces vidéos locales.
Les trois vidéos de référence ne contiennent aucune piste audio.
