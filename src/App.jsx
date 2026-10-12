import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  activeSeason,
  initialData,
  localMedia,
  teams,
  totalFor,
  count,
  validateFile,
} from "./model.js";
import {
  configured,
  db,
  mediaUrl,
  readPublic,
  verifyAdmin,
  rpc,
  upload,
} from "./data.js";
import { updateSeo } from "./seo.js";
export { readPublic } from "./data.js";

const pages = [
  ["/", "Accueil"],
  ["/parcours", "Mon parcours"],
  ["/statistiques", "Statistiques"],
  ["/medias", "Médias"],
  ["/contact", "Contact"],
];
function Arrow() {
  return <span aria-hidden="true">↗</span>;
}
const NavigationContext = createContext(null);
function Link({ href, children, ...props }) {
  const navigate = useContext(NavigationContext);
  return (
    <a href={href} onClick={(e) => navigate(e, href)} {...props}>
      {children}
    </a>
  );
}
export default function App({
  initialPath = "/",
  initialPublicData = initialData,
}) {
  const [path, setPath] = useState(initialPath);
  const [menu, setMenu] = useState(false);
  const [data, setData] = useState(initialPublicData);
  const [dataError, setDataError] = useState("");
  const [admin, setAdmin] = useState(false);
  const [authError, setAuthError] = useState("");
  const main = useRef(null);
  const loading = useRef(0);
  async function refresh() {
    const id = ++loading.current;
    try {
      const next = await readPublic();
      if (id === loading.current) {
        setData(next);
        setDataError("");
      }
    } catch (e) {
      if (id === loading.current) setDataError(e.message);
      throw e;
    }
  }
  async function authRefresh() {
    try {
      setAdmin(await verifyAdmin());
      setAuthError("");
    } catch (e) {
      setAdmin(false);
      setAuthError(e.message);
    }
  }
  useEffect(() => {
    refresh().catch(() => {});
    authRefresh();
    const focus = () => {
      refresh().catch(() => {});
      authRefresh();
    };
    window.addEventListener("focus", focus);
    const timer = configured
      ? setInterval(() => {
          if (!document.hidden) refresh().catch(() => {});
        }, 30000)
      : null;
    const subscription = db?.auth.onAuthStateChange(() => {
      setTimeout(authRefresh, 0);
    }).data.subscription;
    return () => {
      window.removeEventListener("focus", focus);
      clearInterval(timer);
      subscription?.unsubscribe();
    };
  }, []);
  function scrollToDestination(hash) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (hash)
          document
            .getElementById(decodeURIComponent(hash.slice(1)))
            ?.scrollIntoView();
        else {
          window.scrollTo({ top: 0, behavior: "instant" });
          main.current?.focus({ preventScroll: true });
        }
      }),
    );
  }
  useEffect(() => {
    const pop = () => {
      setPath(location.pathname.replace(/\/$/, "") || "/");
      setMenu(false);
      scrollToDestination(location.hash);
    };
    window.addEventListener("popstate", pop);
    if (location.hash) scrollToDestination(location.hash);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    const chosen =
      [...data.media, ...localMedia].find(
        (m) => m.id === data.settings.hero_media_id && m.kind === "image",
      ) || localMedia[0];
    updateSeo(
      path,
      new URL(mediaUrl(chosen), "https://edward-plante.vercel.app").href,
    );
  }, [path, data.media, data.settings.hero_media_id]);
  function navigate(e, href) {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey
    )
      return;
    e.preventDefault();
    const target = new URL(href, location.origin);
    history.pushState({}, "", target.pathname + target.hash);
    setPath(target.pathname);
    setMenu(false);
    scrollToDestination(target.hash);
  }
  const season = activeSeason(data);
  const media = [
    ...data.media,
    ...localMedia.filter(
      (m) => !data.settings.hidden_local_media.includes(m.id),
    ),
  ];
  const hero =
    [...data.media, ...localMedia].find(
      (m) => m.id === data.settings.hero_media_id && m.kind === "image",
    ) || localMedia[0];
  const shared = { data, admin, refresh, Link };
  return (
    <NavigationContext.Provider value={navigate}>
      <>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        <header className="header">
          <div className="shell nav-wrap">
            <Link
              href="/"
              className="brand"
              aria-label="Edward Plante, accueil"
            >
              EP<span className="brand-dot">.</span>
              <span className="brand-name">EDWARD PLANTE</span>
            </Link>
            <button
              className="menu-toggle"
              aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menu}
              aria-controls="navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? "Fermer ×" : "Menu ☰"}
            </button>
            <nav
              id="navigation"
              aria-label="Navigation principale"
              className={menu ? "nav open" : "nav"}
            >
              {pages.map(([href, label]) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={path === href ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="contenu" tabIndex="-1" ref={main}>
          {dataError && (
            <div className="shell notice" role="status">
              {dataError}{" "}
              <button onClick={() => refresh().catch(() => {})}>
                Réessayer
              </button>
            </div>
          )}
          {path === "/" && (
            <>
              <section className="hero shell">
                <div className="hero-copy">
                  <p className="eyebrow">
                    <span className="live-dot" />
                    SOCCER & FUTSAL · QUÉBEC
                  </p>
                  <h1>
                    Edward
                    <br />
                    <span>Plante</span>
                    <span className="name-period">.</span>
                  </h1>
                  <p className="hero-position">
                    Ailier gauche <span>/</span> Pied droit
                  </p>
                  <p className="intro">
                    J’ai 13 ans et je joue depuis l’âge de 6 ans.
                    <br />
                    Aujourd’hui au CS Trident AA, je veux retourner
                    <br className="desktop-break" /> jouer AAA la saison
                    prochaine.
                  </p>
                  <div className="hero-actions">
                    <Link href="/parcours" className="button primary">
                      Mon parcours <Arrow />
                    </Link>
                    <Link href="/medias" className="text-link">
                      Voir mes médias <Arrow />
                    </Link>
                  </div>
                  <div className="club-line">
                    <span className="club-mark">C</span>
                    <div>
                      <strong>CS Trident</strong>
                      <small>Soccer · AA</small>
                    </div>
                    <span className="jersey">
                      <small>SOCCER</small>#77
                    </span>
                  </div>
                  <div className="club-line futsal-club-line">
                    <span className="club-mark">JM</span>
                    <div>
                      <strong>JM Bleu & Or</strong>
                      <small>Futsal scolaire</small>
                    </div>
                    <span className="jersey">
                      <small>FUTSAL</small>#40
                    </span>
                  </div>
                </div>
                <div className="hero-visual">
                  <span className="background-number" aria-hidden="true">
                    77
                  </span>
                  <div className="photo-frame">
                    <img
                      className="hero-photo"
                      src={mediaUrl(hero)}
                      alt={hero.alt}
                      fetchPriority="high"
                      width="516"
                      height="740"
                    />
                    <div className="photo-label">
                      <span>JM BLEU & OR</span>
                      <span>
                        Sur le terrain <Arrow />
                      </span>
                    </div>
                  </div>
                  <span className="photo-edge" aria-hidden="true">
                    EDWARD PLANTE / SOCCER & FUTSAL
                  </span>
                </div>
              </section>
              <section className="numbers shell" id="chiffres">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">CS TRIDENT · {season.label}</p>
                    <h2>
                      Le jeu en chiffres<span className="lime">.</span>
                    </h2>
                  </div>
                  <Link href="/statistiques" className="text-link">
                    Toutes les statistiques <Arrow />
                  </Link>
                </div>
                <div className="home-totals">
                  <Stat
                    value={totalFor(data, season.id, "trident").goals}
                    label="Buts"
                  />
                  <Stat
                    value={totalFor(data, season.id, "trident").assists}
                    label="Passes décisives"
                  />
                  <div className="numbers-note">
                    <span className="small-label">SAISON ACTIVE</span>
                    <strong>{season.label}</strong>
                    <p>
                      Les chiffres du CS Trident,
                      <br />
                      mis à jour au fil de la saison.
                    </p>
                  </div>
                </div>
                {admin && (
                  <Link href="/statistiques#totaux" className="admin-link">
                    Modifier les chiffres →
                  </Link>
                )}
              </section>
              <section className="home-media shell">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">PHOTOS & VIDÉOS</p>
                    <h2>
                      Au bord du terrain<span className="lime">.</span>
                    </h2>
                  </div>
                  <Link href="/medias" className="text-link">
                    Tous mes médias <Arrow />
                  </Link>
                </div>
                <div className="photo-strip">
                  {media
                    .filter((m) => m.kind === "image")
                    .slice(1, 4)
                    .map((m) => (
                      <Link href="/medias" key={m.id}>
                        <img
                          src={mediaUrl(m, true)}
                          alt={m.alt}
                          loading="lazy"
                          width="550"
                          height="740"
                        />
                        <span>
                          {m.title} <Arrow />
                        </span>
                      </Link>
                    ))}
                </div>
              </section>
              <section className="contact-band shell">
                <p>
                  Pour parler soccer
                  <br />
                  ou prendre contact.
                </p>
                <Link href="/contact" className="button primary">
                  Me joindre <Arrow />
                </Link>
              </section>
            </>
          )}
          {path === "/parcours" && (
            <section className="shell page">
              <PageTitle
                eyebrow="MON PARCOURS"
                title={
                  <>
                    Le soccer, depuis
                    <br />
                    l’âge de 6 ans<span className="lime">.</span>
                  </>
                }
              />
              <div className="journey-layout">
                <div>
                  <p className="lead">
                    Je m’appelle Edward Plante. J’ai 13 ans, je viens du Québec
                    et je joue à l’aile gauche, avec le pied droit.
                  </p>
                  <p className="body-copy">
                    Le soccer fait partie de ma vie depuis l’âge de 6 ans. Je
                    joue actuellement au CS Trident, au niveau AA, avec le
                    numéro 77. Je joue aussi au futsal scolaire avec JM Bleu &
                    Or.
                  </p>
                  <dl className="profile-facts">
                    <div>
                      <dt>Région</dt>
                      <dd>Québec</dd>
                    </div>
                    <div>
                      <dt>Âge actuel</dt>
                      <dd>13 ans</dd>
                    </div>
                    <div>
                      <dt>Poste</dt>
                      <dd>Ailier gauche</dd>
                    </div>
                    <div>
                      <dt>Pied dominant</dt>
                      <dd>Droit</dd>
                    </div>
                  </dl>
                </div>
                <figure className="journey-photo">
                  <img
                    src="/images/soccer-bleu.png"
                    alt={localMedia[4].alt}
                    width="550"
                    height="740"
                  />
                  <figcaption>Soccer · Numéro 77</figcaption>
                </figure>
              </div>
              <div className="team-rows">
                {teams.map((t) => (
                  <div className={`team-row ${t.id}`} key={t.id}>
                    <span className="team-initial">{t.initials}</span>
                    <div>
                      <p className="eyebrow">{t.sport}</p>
                      <h2>{t.name}</h2>
                    </div>
                    <span>{t.detail}</span>
                  </div>
                ))}
              </div>
              <div className="objective">
                <p className="eyebrow">MON OBJECTIF</p>
                <h2>
                  Retourner jouer AAA
                  <br />
                  la saison prochaine.
                </h2>
                <Link href="/medias" className="text-link">
                  Me voir sur le terrain <Arrow />
                </Link>
              </div>
            </section>
          )}
          {path === "/statistiques" && <Statistics {...shared} />}
          {path === "/medias" && (
            <MediaPage {...shared} media={media} hero={hero} />
          )}
          {path === "/contact" && (
            <section className="shell page contact-page">
              <PageTitle
                eyebrow="CONTACT"
                title={
                  <>
                    On se parle<span className="lime">?</span>
                  </>
                }
              />
              <p className="lead">
                Pour une question sur mon parcours ou une occasion de jouer,
                vous pouvez me joindre par courriel.
              </p>
              <div className="contact-details">
                <h2>Edward Plante</h2>
                <a href="mailto:planteedward@gmail.com">
                  <span className="small-label">COURRIEL</span>
                  <span>
                    planteedward@gmail.com <Arrow />
                  </span>
                </a>
              </div>
              <p className="contact-region">Québec · Soccer & futsal</p>
            </section>
          )}
          {path === "/admin" && (
            <Admin
              {...shared}
              authRefresh={authRefresh}
              authError={authError}
            />
          )}
          {!pages.some((p) => p[0] === path) && path !== "/admin" && (
            <section className="shell page">
              <PageTitle eyebrow="404" title="Cette page n’existe pas." />
              <Link className="button primary" href="/">
                Retour à l’accueil <Arrow />
              </Link>
            </section>
          )}
        </main>
        <footer className="footer shell">
          <div>
            <Link href="/" className="brand">
              EP<span className="brand-dot">.</span>
            </Link>
            <p>
              Edward Plante · Québec
              <br />
              Soccer & futsal
            </p>
          </div>
          <div className="footer-links">
            <Link href="/contact">
              Contact <Arrow />
            </Link>
            <Link href="/admin">
              {admin ? "Administration" : "Espace privé"}
            </Link>
            <small>© {new Date().getFullYear()} Edward Plante</small>
          </div>
        </footer>
      </>
    </NavigationContext.Provider>
  );
}
function PageTitle({ eyebrow, title }) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
    </div>
  );
}
function Stat({ value, label }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
function Feedback({ message, error }) {
  return (
    <>
      {error && (
        <p className="feedback error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="feedback success" role="status">
          {message}
        </p>
      )}
    </>
  );
}
function Statistics({ data, admin, refresh }) {
  const [selected, setSelected] = useState(activeSeason(data).id);
  useEffect(() => {
    if (!data.seasons.some((s) => s.id === selected))
      setSelected(activeSeason(data).id);
  }, [data.seasons, selected]);
  return (
    <section className="shell page">
      <PageTitle
        eyebrow="STATISTIQUES"
        title={
          <>
            Le jeu en chiffres<span className="lime">.</span>
          </>
        }
      />
      <div className="season-bar">
        <p>
          Matchs, buts et passes décisives.
          <br />
          Une saison à la fois.
        </p>
        <label>
          Saison
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {data.seasons.map((s) => (
              <option value={s.id} key={s.id}>
                {s.label}
                {s.active ? " · active" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div id="totaux">
        {teams.map((t) => {
          const row = totalFor(data, selected, t.id);
          return (
            <section className={`stats-team ${t.id}`} key={t.id}>
              <div className="team-heading">
                <span className="team-initial">{t.initials}</span>
                <div>
                  <p className="eyebrow">
                    {t.sport} ·{" "}
                    {data.seasons.find((s) => s.id === selected)?.label}
                  </p>
                  <h2>{t.name}</h2>
                </div>
                <span className="team-detail">{t.detail}</span>
              </div>
              <div className="stats-grid">
                <Stat value={row.matches} label="Matchs joués" />
                <Stat value={row.goals} label="Buts" />
                <Stat value={row.assists} label="Passes décisives" />
              </div>
              {admin && (
                <StatsEditor
                  key={`${selected}-${t.id}`}
                  row={row}
                  refresh={refresh}
                />
              )}
            </section>
          );
        })}
      </div>
      <p className="muted">
        Les valeurs restent à 0 tant qu’aucun chiffre n’a été saisi pour la
        saison.
      </p>
    </section>
  );
}
function StatsEditor({ row, refresh }) {
  const [draft, setDraft] = useState(row);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(row);
  }, [row.matches, row.goals, row.assists, row.revision]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await rpc("save_totals", {
        p_season: row.season_id,
        p_team: row.team,
        p_matches: count(draft.matches),
        p_goals: count(draft.goals),
        p_assists: count(draft.assists),
        p_revision: row.revision,
      });
      setMessage("Chiffres enregistrés et publiés.");
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="private-panel" onSubmit={save}>
      <p className="small-label">MODIFICATION PRIVÉE</p>
      <div className="edit-counts">
        {[
          ["matches", "Matchs joués"],
          ["goals", "Buts"],
          ["assists", "Passes décisives"],
        ].map(([field, label]) => (
          <label key={field}>
            {label}
            <div className="stepper">
              <button
                type="button"
                disabled={busy || Number(draft[field]) <= 0}
                aria-label={`Diminuer : ${label}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    [field]: Math.max(0, Number(draft[field]) - 1),
                  })
                }
              >
                ↓
              </button>
              <input
                aria-label={label}
                type="number"
                min="0"
                max="10000"
                step="1"
                required
                value={draft[field]}
                disabled={busy}
                onChange={(e) =>
                  setDraft({ ...draft, [field]: e.target.value })
                }
              />
              <button
                type="button"
                disabled={busy || Number(draft[field]) >= 10000}
                aria-label={`Augmenter : ${label}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    [field]: Math.min(10000, Number(draft[field]) + 1),
                  })
                }
              >
                ↑
              </button>
            </div>
          </label>
        ))}
      </div>
      <button className="button primary" disabled={busy}>
        {busy ? "Enregistrement…" : "Publier les chiffres"}
      </button>
      <Feedback message={message} error={error} />
    </form>
  );
}
function MediaPage({ data, admin, refresh, media, hero }) {
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState(null);
  const close = useRef(null);
  const opener = useRef(null);
  useEffect(() => {
    if (!view) return;
    close.current?.focus();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e) => {
      if (e.key === "Escape") setView(null);
      if (e.key === "Tab") {
        const els = [
          ...document.querySelectorAll(".lightbox button, .lightbox video"),
        ];
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = prior;
      document.removeEventListener("keydown", key);
      opener.current?.focus();
    };
  }, [view]);
  const filtered = media.filter((m) => filter === "all" || m.kind === filter);
  const references = filtered.filter((m) => m.collection === "previous-u13-aaa");
  const visible = filtered.filter((m) => m.collection !== "previous-u13-aaa");
  return (
    <section className="shell page">
      <PageTitle
        eyebrow="MÉDIAS"
        title={
          <>
            Sur le terrain<span className="lime">.</span>
          </>
        }
      />
      <div className="media-toolbar">
        <p>Des photos et des moments de soccer et de futsal.</p>
        <div className="filters" role="group" aria-label="Filtrer les médias">
          {[
            ["all", "Tout"],
            ["image", "Photos"],
            ["video", "Vidéos"],
          ].map(([v, text]) => (
            <button
              key={v}
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
      {admin && (
        <MediaManager data={data} refresh={refresh} media={media} hero={hero} />
      )}
      {references.length > 0 && (
        <section className="reference-videos" aria-labelledby="reference-title">
          <p className="eyebrow">VIDÉOS DE RÉFÉRENCE</p>
          <h2 id="reference-title">Saison dernière · <span className="lime">U13 AAA</span></h2>
          <p>Trois extraits de ma saison dernière en U13 AAA, pour découvrir mon jeu sur le terrain.</p>
          <div className="reference-grid">
            {references.map((m) => (
              <figure key={m.id}>
                <video src={mediaUrl(m)} poster={m.poster} controls playsInline preload="none" aria-label={m.alt} />
                <figcaption>{m.title}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {visible.length ? (
        <div className="gallery">
          {visible.map((m) => (
            <figure key={m.id}>
              <button
                className="media-open"
                aria-label={`Ouvrir : ${m.title}`}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setView(m);
                }}
              >
                {m.kind === "image" ? (
                  <img
                    src={mediaUrl(m, true)}
                    alt={m.alt}
                    width="550"
                    height="740"
                    loading="lazy"
                  />
                ) : (
                  <div className="video-preview">
                    <span aria-hidden="true">▷</span>
                    <span>Vidéo · {m.title}</span>
                  </div>
                )}
                <span className="image-expand" aria-hidden="true">
                  ↗
                </span>
              </button>
              <figcaption>{m.title}</figcaption>
            </figure>
          ))}
        </div>
      ) : references.length ? null : (
        <div className="empty-state">
          {filter === "video"
            ? "Aucune vidéo publiée pour le moment."
            : "Aucun média publié pour le moment."}
        </div>
      )}
      {view && (
        <div
          className="lightbox-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setView(null);
          }}
        >
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={view.title}
          >
            <button
              ref={close}
              className="lightbox-close"
              onClick={() => setView(null)}
            >
              Fermer ×
            </button>
            {view.kind === "image" ? (
              <img src={mediaUrl(view)} alt={view.alt} />
            ) : (
              <video
                src={mediaUrl(view)}
                controls
                playsInline
                preload="metadata"
                tabIndex="0"
                aria-label={view.alt}
              />
            )}
            <p>{view.title}</p>
          </div>
        </div>
      )}
    </section>
  );
}
function MediaManager({ data, refresh, media, hero }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState(null);
  const [asHero, setAsHero] = useState(false);
  const [importKind, setImportKind] = useState("image");
  const [deleting, setDeleting] = useState(null);
  const form = useRef(null);
  const panel = useRef(null);
  const fileInput = useRef(null);
  function openImport(kind) {
    setImportKind(kind);
    setAsHero(false);
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
    panel.current.open = true;
    requestAnimationFrame(() => fileInput.current?.focus());
  }
  async function action(fn, success) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await fn();
      setMessage(success);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function importMedia(e) {
    e.preventDefault();
    await action(async () => {
      if (!file) throw new Error("Choisissez un fichier.");
      if (!file.type.startsWith(`${importKind}/`))
        throw new Error(
          importKind === "video"
            ? "Choisissez une vidéo MP4 ou WebM."
            : "Choisissez une photo JPG, PNG ou WebP.",
        );
      validateFile(file, asHero);
      const result = await upload(file, title, alt);
      if (asHero) await rpc("choose_hero", { p_media: result.id });
      form.current.reset();
      setFile(null);
      setTitle("");
      setAlt("");
      setAsHero(false);
    }, "Média importé et publié.");
  }
  return (
    <>
      <div
        className="private-media-actions"
        aria-label="Commandes administrateur"
      >
        <button
          className="button primary"
          disabled={busy}
          onClick={() => openImport("video")}
        >
          Ajouter une vidéo ↑
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => openImport("image")}
        >
          Ajouter une photo ↑
        </button>
      </div>
      <details className="private-panel" ref={panel}>
        <summary>Gérer les médias et la photo d’accueil</summary>
        <form onSubmit={importMedia} ref={form} className="upload-form">
          <h3>
            {importKind === "video"
              ? "Importer une vidéo"
              : "Importer une photo"}
          </h3>
          <label>
            {importKind === "video" ? "Vidéo" : "Photo"}
            <input
              type="file"
              ref={fileInput}
              accept={
                importKind === "video"
                  ? "video/mp4,video/webm"
                  : "image/jpeg,image/png,image/webp"
              }
              required
              disabled={busy}
              onChange={(e) => setFile(e.target.files[0])}
            />
          </label>
          <p className="muted">
            JPG, PNG, WebP : 8 Mo maximum. MP4, WebM : 50 Mo maximum.
          </p>
          <label>
            Titre
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength="120"
              required
              disabled={busy}
            />
          </label>
          <label>
            Description pour l’accessibilité
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength="500"
              required
              disabled={busy}
            />
          </label>
          {importKind === "image" && (
            <label className="check">
              <input
                type="checkbox"
                checked={asHero}
                onChange={(e) => setAsHero(e.target.checked)}
                disabled={busy}
              />
              Utiliser cette photo à l’accueil
            </label>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Importation…" : "Importer et publier"}
          </button>
        </form>
        <h3>Photos et vidéos publiées</h3>
        <div className="media-admin-list">
          {media.map((m) => (
            <div key={m.id}>
              <span>
                {m.title}
                {hero.id === m.id && <small> · Photo d’accueil</small>}
              </span>
              <div>
                {m.kind === "image" && (
                  <button
                    disabled={busy || hero.id === m.id}
                    onClick={() =>
                      action(
                        () => rpc("choose_hero", { p_media: m.id }),
                        "Photo d’accueil publiée.",
                      )
                    }
                  >
                    Choisir pour l’accueil
                  </button>
                )}
                <button
                  disabled={busy || hero.id === m.id}
                  onClick={() => setDeleting(m)}
                >
                  Retirer
                </button>
              </div>
              {deleting?.id === m.id && (
                <div className="delete-confirm">
                  <p>Retirer « {m.title} » de la galerie ?</p>
                  <button
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await rpc("remove_media", { p_media: m.id });
                        setDeleting(null);
                      }, "Média retiré de la galerie.")
                    }
                  >
                    Confirmer le retrait
                  </button>
                  <button onClick={() => setDeleting(null)}>Annuler</button>
                </div>
              )}
            </div>
          ))}
        </div>
        {data.settings.hidden_local_media.length > 0 && (
          <button
            disabled={busy}
            onClick={() =>
              action(
                () => rpc("restore_local_media"),
                "Photos locales rétablies.",
              )
            }
          >
            Rétablir les médias locaux retirés
          </button>
        )}
        <Feedback message={message} error={error} />
      </details>
    </>
  );
}
function Admin({ data, admin, refresh, Link, authRefresh, authError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [label, setLabel] = useState("");
  const [remove, setRemove] = useState(null);
  async function action(fn, success = "") {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await fn();
      if (success) setMessage(success);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function login(e) {
    e.preventDefault();
    await action(async () => {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error)
        throw new Error(
          "Connexion refusée. Vérifiez votre courriel et votre mot de passe.",
        );
      if (!(await verifyAdmin())) {
        await db.auth.signOut();
        throw new Error("Ce compte ne possède pas les droits administrateur.");
      }
      setPassword("");
      await authRefresh();
    });
  }
  return (
    <section className="shell page admin-page">
      <PageTitle
        eyebrow="ESPACE PRIVÉ"
        title={
          <>
            Administration<span className="lime">.</span>
          </>
        }
      />
      {!configured ? (
        <div className="setup-notice">
          <h2>L’administration reste à configurer.</h2>
          <p>
            Le site public et les photos locales fonctionnent déjà. Pour activer
            la gestion privée, ajoutez VITE_SUPABASE_URL et
            VITE_SUPABASE_PUBLISHABLE_KEY, exécutez la migration SQL, autorisez
            votre compte administrateur et déployez la fonction upload-media.
          </p>
          <p>Les étapes sont détaillées dans le fichier README du projet.</p>
        </div>
      ) : !admin ? (
        <form onSubmit={login} className="login-form">
          <p>Connexion réservée au compte administrateur autorisé.</p>
          <label>
            Courriel
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Vérification…" : "Se connecter"}
          </button>
        </form>
      ) : (
        <>
          <div className="admin-intro">
            <p>Vous êtes connecté au compte administrateur.</p>
            <button
              disabled={busy}
              onClick={() =>
                action(async () => {
                  const { error } = await db.auth.signOut();
                  if (error) throw error;
                  await authRefresh();
                })
              }
            >
              Se déconnecter
            </button>
          </div>
          <div className="admin-shortcuts">
            <Link href="/statistiques#totaux" className="button primary">
              Modifier les chiffres <Arrow />
            </Link>
            <Link href="/medias" className="button secondary">
              Gérer les médias et la photo <Arrow />
            </Link>
          </div>
          <section className="private-panel">
            <h2>Les saisons</h2>
            <p>La saison active alimente les chiffres de l’accueil.</p>
            <div className="season-list">
              {data.seasons.map((s) => (
                <div key={s.id}>
                  <strong>{s.label}</strong>
                  <span>{s.active ? "Saison active" : ""}</span>
                  {!s.active && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await rpc("activate_season", { p_season: s.id });
                            setMessage("Saison active enregistrée.");
                            await refresh();
                          })
                        }
                      >
                        Activer
                      </button>
                      <button disabled={busy} onClick={() => setRemove(s)}>
                        Supprimer
                      </button>
                    </>
                  )}
                  {remove?.id === s.id && (
                    <div className="delete-confirm">
                      <p>
                        Supprimer cette saison et ses chiffres ? Cette action
                        est définitive.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            await rpc("delete_season", { p_season: s.id });
                            setRemove(null);
                            setMessage("Saison supprimée.");
                            await refresh();
                          })
                        }
                      >
                        Confirmer la suppression
                      </button>
                      <button onClick={() => setRemove(null)}>Annuler</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <form
              className="season-form"
              onSubmit={(e) => {
                e.preventDefault();
                action(async () => {
                  if (
                    !/^20\d{2}-20\d{2}$/.test(label) ||
                    Number(label.slice(5)) !== Number(label.slice(0, 4)) + 1
                  )
                    throw new Error(
                      "Utilisez deux années consécutives, par exemple 2027-2028.",
                    );
                  await rpc("create_season", { p_label: label });
                  setLabel("");
                  setMessage("Saison créée avec des chiffres à 0.");
                  await refresh();
                });
              }}
            >
              <label>
                Nouvelle saison
                <input
                  placeholder="2027-2028"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  maxLength="9"
                  disabled={busy}
                />
              </label>
              <button className="button secondary" disabled={busy}>
                Ajouter
              </button>
            </form>
          </section>
        </>
      )}
      <Feedback message={message} error={error || authError} />
    </section>
  );
}
