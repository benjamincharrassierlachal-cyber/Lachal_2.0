import {
  loadData,
  buildStoreModel,
  buildAdminModel,
  buildAdminTrend,
  allWeeks,
  weeksWithDataAdmin,
  weekHasData,
  aggregateRange,
  rangeLabel,
  ADMIN_CODE,
} from "./data.js";
import { settings, setSetting, recordVisit, claimedBadges, claimBadge } from "./state.js";
import { icon } from "./icons.js";
import { buildBadges } from "./badges.js";
import { chargerManifest, verifierSession, deconnecter as deconnecterLachal } from "./auth.js";
import {
  renderRewards,
  renderDashboard,
  renderAdmin,
  renderMetricDetail,
  renderTrophies,
  renderSettings,
  renderStats,
} from "./views.js";

const app = document.getElementById("app");

function isAdmin() {
  return settings.storeCode === ADMIN_CODE;
}

// Le mot de passe admin, une fois entre, reste valide indefiniment sur cet
// appareil (survit a l'onglet mis en veille/tue par le telephone en
// arriere-plan, contrairement a une session d'onglet classique) : seule une
// deconnexion explicite (bouton "Deconnexion" des Reglages) le redemande.
function isAdminUnlocked() {
  try {
    return localStorage.getItem("adminUnlocked") === "1";
  } catch {
    return false;
  }
}
function unlockAdmin() {
  try {
    localStorage.setItem("adminUnlocked", "1");
  } catch {
    /* navigation privee : tant pis, on redemandera le mot de passe */
  }
}
function lockAdmin() {
  try {
    localStorage.removeItem("adminUnlocked");
  } catch {
    /* rien a nettoyer */
  }
}

// Role de la connexion unique (page d'accueil) : "admin" ou "magasin".
let roleSession = null;

// Deconnexion explicite (bouton "Deconnexion" des Reglages, admin seulement) :
// on ferme la session Lachal et on revient sur l'accueil.
function logoutAdmin() {
  lockAdmin();
  deconnecterLachal();
  location.href = "./";
}

// L'admin quitte la fiche d'un magasin pour revenir a la vue d'ensemble.
function retourAdmin(data) {
  setSetting("storeCode", ADMIN_CODE);
  if (location.hash) location.hash = "";
  checkRewards(data);
}

let adminSort = "score"; // score | name | trophies
let adminTab = "overview"; // overview | stats
// Semaine consultee sur le tableau de bord d'un magasin (null = la derniere).
// Remise a null en entrant dans un nouveau contexte (changement de magasin,
// espace admin) : voir enterDashboard.
let dashboardWeek = null;
// Meme principe cote admin, mais une seule semaine pour tous les magasins
// a la fois (l'admin n'a pas de "semaine courante" propre a un magasin).
let adminWeek = null;
// Periode consultee ({from, to}, semaines "AAAA-Sxx") : cumul de plusieurs
// semaines a la place d'une seule. Exclusive de dashboardWeek/adminWeek.
let dashboardPeriod = null;
let adminPeriod = null;

function resetView() {
  dashboardWeek = null;
  adminWeek = null;
  dashboardPeriod = null;
  adminPeriod = null;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.theme);
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("metric-")) return { name: "metric", key: hash.slice(7) };
  if (hash === "trophies") return { name: "trophies" };
  if (hash === "settings") return { name: "settings" };
  if (hash === "stats") return { name: "stats" };
  return { name: "dashboard" };
}

function nav(name, key) {
  location.hash = name === "metric" ? `metric-${key}` : name;
}

function weekTitle(semaine) {
  if (!semaine) return "";
  const [, num] = semaine.split("-S");
  return `Semaine ${parseInt(num, 10)}`;
}

function buildShell(data) {
  const backToAdmin = !isAdmin() && isAdminUnlocked();
  app.innerHTML = `
    <header class="app-header">
      <div>
        <div class="store-name" id="hdr-store"></div>
        <div class="week-label" id="hdr-week"></div>
      </div>
      <div class="header-actions">
        <button class="icon-btn" id="hdr-calendar" title="Choisir la semaine">${icon("calendar", 20)}</button>
        ${backToAdmin ? `<button class="admin-back-btn" id="hdr-admin-back">${icon("chevronLeft", 16)}Admin</button>` : ""}
        <button class="icon-btn" id="hdr-settings">${icon("gear", 20)}</button>
      </div>
    </header>
    <main id="view"></main>
    <nav class="bottom-nav">
      <button class="nav-btn" data-nav="dashboard">${icon("home", 20)}<span>Accueil</span></button>
      ${isAdmin() ? "" : `
      <button class="nav-btn" data-nav="stats">${icon("trending", 20)}<span>Stats</span></button>
      <button class="nav-btn" data-nav="trophies">${icon("trophy", 20)}<span>Trophees</span></button>`}
    </nav>
  `;
  app.querySelectorAll("[data-nav]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.nav === "dashboard") resetView();
      nav(b.dataset.nav);
      render(data);
    })
  );
  document.getElementById("hdr-settings").addEventListener("click", () => nav("settings"));
  document.getElementById("hdr-calendar")?.addEventListener("click", () => showWeekPicker(data));
  if (backToAdmin) {
    document.getElementById("hdr-admin-back").addEventListener("click", () => {
      setSetting("storeCode", ADMIN_CODE);
      checkRewards(data);
    });
  }
}

// Petite feuille modale listant les semaines disponibles, du plus recent au
// plus ancien : celles d'un magasin, ou (en admin) toutes les semaines
// connues du groupe. Ajoutee a <body> (pas a #view) pour survivre a un
// re-rendu du contenu pendant qu'elle est ouverte.
function showWeekPicker(data) {
  document.getElementById("week-picker")?.remove();

  // liste des semaines a proposer, et comment savoir laquelle est active
  // periodWeeks : semaines proposables pour une periode (celles qui ont un
  // releve), de la plus ancienne a la plus recente.
  let semaines, isActive, scoreOf, periodWeeks;
  const activePeriod = isAdmin() ? adminPeriod : dashboardPeriod;
  if (isAdmin()) {
    semaines = allWeeks(data);
    isActive = (semaine) => !adminPeriod && (adminWeek ? semaine === adminWeek : semaine === semaines[0]);
    scoreOf = (semaine) => buildAdminModel(data, semaine).score;
    periodWeeks = weeksWithDataAdmin(data);
  } else {
    const model = buildStoreModel(data, settings.storeCode);
    semaines = model.history.slice().reverse().map((w) => w.semaine);
    isActive = (semaine) => !dashboardPeriod && (dashboardWeek ? semaine === dashboardWeek : semaine === model.currentWeek?.semaine);
    scoreOf = (semaine) => model.history.find((w) => w.semaine === semaine)?.score ?? null;
    periodWeeks = model.history.filter((w) => weekHasData(w, model.metrics)).map((w) => w.semaine);
  }
  if (!semaines.length) return;

  // L'annee n'est precisee dans les listes que si les donnees en couvrent plusieurs.
  const multiYear = new Set(periodWeeks.map((s) => s.split("-S")[0])).size > 1;
  const optionLabel = (semaine) => weekTitle(semaine) + (multiYear ? ` (${semaine.split("-S")[0]})` : "");
  const defaultTo = activePeriod?.to || periodWeeks[periodWeeks.length - 1];
  const defaultFrom = activePeriod?.from || periodWeeks[Math.max(0, periodWeeks.length - 3)];
  const periodOptions = (selected) => periodWeeks
    .map((s) => `<option value="${s}" ${s === selected ? "selected" : ""}>${optionLabel(s)}</option>`)
    .join("");
  const periodBlock = periodWeeks.length < 2 ? "" : `
      <div class="week-period">
        <div class="week-period-title">Voir une période${activePeriod ? ` <span class="week-period-current">(${rangeLabel(activePeriod.from, activePeriod.to)})</span>` : ""}</div>
        <div class="week-period-row">
          <label>De<select id="wp-from">${periodOptions(defaultFrom)}</select></label>
          <label>à<select id="wp-to">${periodOptions(defaultTo)}</select></label>
          <button class="week-period-go" data-period-go>Voir</button>
        </div>
      </div>`;

  const overlay = document.createElement("div");
  overlay.id = "week-picker";
  overlay.className = "week-picker-overlay";
  overlay.innerHTML = `
    <div class="week-picker-sheet">
      <div class="week-picker-head">
        <span>Choisir une semaine</span>
        <button class="icon-btn" data-close>${icon("close", 18)}</button>
      </div>
      ${periodBlock}
      <div class="week-picker-list">
        ${semaines
          .map((semaine) => {
            const sc = scoreOf(semaine);
            return `<button class="week-picker-row ${isActive(semaine) ? "active" : ""}" data-semaine="${semaine}">
              <span>${weekTitle(semaine)}</span>
              <span class="week-picker-score" style="color:${sc === null ? "var(--text-dim)" : sc >= 100 ? "var(--gold)" : "var(--text-dim)"}">${sc ?? "-"}%</span>
            </button>`;
          })
          .join("")}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.querySelectorAll("[data-semaine]").forEach((b) => {
    b.addEventListener("click", () => {
      if (isAdmin()) {
        adminWeek = b.dataset.semaine;
        adminPeriod = null;
        adminTab = "overview";
      } else {
        dashboardWeek = b.dataset.semaine;
        dashboardPeriod = null;
        if (parseRoute().name !== "dashboard") nav("dashboard");
      }
      close();
      render(data);
    });
  });
  overlay.querySelector("[data-period-go]")?.addEventListener("click", () => {
    let from = overlay.querySelector("#wp-from").value;
    let to = overlay.querySelector("#wp-to").value;
    if (from > to) [from, to] = [to, from];
    if (isAdmin()) {
      adminPeriod = { from, to };
      adminWeek = null;
      adminTab = "overview";
    } else {
      dashboardPeriod = { from, to };
      dashboardWeek = null;
      if (parseRoute().name !== "dashboard") nav("dashboard");
    }
    close();
    render(data);
  });
}

// Plus d'ecran de choix de magasin ici : la connexion (code magasin ou admin)
// se fait une seule fois sur la page d'accueil, qui decide du magasin.
async function boot(data) {
  applyTheme();
  recordVisit();

  let session = null;
  try {
    session = await verifierSession(await chargerManifest());
  } catch {
    session = null;
  }
  if (!session) {
    location.replace("./");
    return;
  }
  roleSession = session.role;
  if (session.role === "admin") {
    unlockAdmin();
    // on repart de la vue d'ensemble a chaque entree depuis l'accueil
    if (!isAdmin()) setSetting("storeCode", ADMIN_CODE);
  } else {
    lockAdmin();
    if (!data.stores.some((s) => s.code === session.code)) {
      location.replace("./");
      return;
    }
    setSetting("storeCode", session.code); // le magasin ne se change pas
  }
  checkRewards(data);
}

let hashListenerAttached = false;

function enterDashboard(data) {
  resetView();
  buildShell(data);
  render(data);
  if (!hashListenerAttached) {
    hashListenerAttached = true;
    window.addEventListener("hashchange", () => render(data));
  }
}

// Trophees debloques mais jamais "recuperes" a l'ecran : on les propose
// avant d'entrer dans l'appli, comme un ecran de recompense de jeu.
// Ne s'applique pas a l'espace admin (pas de trophees a son nom).
function checkRewards(data) {
  if (isAdmin()) {
    enterDashboard(data);
    return;
  }
  const model = buildStoreModel(data, settings.storeCode);
  const badges = buildBadges(model, settings.visits);
  const claimed = new Set(claimedBadges(settings.storeCode));
  const fresh = badges.filter((b) => b.unlocked && !claimed.has(b.id));
  if (fresh.length === 0) {
    enterDashboard(data);
    return;
  }
  showRewardsScreen(data, fresh);
}

function showRewardsScreen(data, freshBadges) {
  const claimedNow = new Set();
  const draw = () => {
    const remaining = freshBadges.filter((b) => !claimedNow.has(b.id));
    if (remaining.length === 0) {
      enterDashboard(data);
      return;
    }
    app.innerHTML = "";
    renderRewards(app, remaining, {
      claim: (id) => {
        claimedNow.add(id);
        claimBadge(settings.storeCode, id);
        draw();
      },
      claimAll: () => {
        remaining.forEach((b) => {
          claimedNow.add(b.id);
          claimBadge(settings.storeCode, b.id);
        });
        draw();
      },
    });
  };
  draw();
}

function render(data) {
  const route = parseRoute();
  const view = document.getElementById("view");
  view.innerHTML = "";

  document.querySelectorAll(".nav-btn").forEach((b) => {
    const active = b.dataset.nav === (route.name === "metric" ? "dashboard" : route.name);
    b.classList.toggle("active", active);
  });

  if (isAdmin()) {
    const adminModel = buildAdminModel(data, adminPeriod || adminWeek);
    document.getElementById("hdr-store").textContent = "ADMIN";
    document.getElementById("hdr-week").textContent = adminPeriod
      ? adminModel.weekLabel + " (période)"
      : weekTitle(adminModel.weekLabel) + (adminWeek ? " (consultee)" : "");

    if (route.name === "settings") {
      renderSettings(view, { ...data, currentStoreName: "Espace admin", isAdmin: true, adminUnlocked: isAdminUnlocked(), role: roleSession }, settings, {
        setShape: (s) => { setSetting("shape", s); render(data); },
        setTheme: (t) => { setSetting("theme", t); applyTheme(); render(data); },
        changeStore: () => retourAdmin(data),
        save: () => nav("dashboard"),
        logout: () => logoutAdmin(),
      });
    } else {
      const rows = adminModel.perStore.map((model) => {
        const badges = buildBadges(model, settings.visits);
        return { store: model.store, model, trophies: { unlocked: badges.filter((b) => b.unlocked).length, total: badges.length } };
      });
      const sorters = {
        score: (a, b) => (b.model.viewWeek?.score ?? -1) - (a.model.viewWeek?.score ?? -1),
        name: (a, b) => a.store.name.localeCompare(b.store.name),
        trophies: (a, b) => b.trophies.unlocked - a.trophies.unlocked,
      };
      rows.sort(sorters[adminSort] || sorters.score);
      const trend = adminTab === "stats" ? buildAdminTrend(data) : null;
      renderAdmin(view, adminModel, settings, rows, trend, {
        sort: adminSort,
        setSort: (s) => { adminSort = s; render(data); },
        tab: adminTab,
        setTab: (t) => { adminTab = t; render(data); },
        resetPeriod: () => { adminPeriod = null; render(data); },
        selectStore: (code) => {
          // Depuis l'admin, on consulte un magasin sans "jouer" a sa place :
          // pas d'ecran de recompense, on va droit a sa fiche.
          setSetting("storeCode", code);
          enterDashboard(data);
        },
      });
    }
    return;
  }

  const model = buildStoreModel(data, settings.storeCode);
  const periodWeek = dashboardPeriod
    ? aggregateRange(model.history, model.metrics, model.objective, dashboardPeriod.from, dashboardPeriod.to)
    : null;
  const onPeriod = route.name === "dashboard" && dashboardPeriod;
  const viewedWeek = onPeriod
    ? periodWeek
    : dashboardWeek
      ? model.history.find((w) => w.semaine === dashboardWeek) || model.currentWeek
      : model.currentWeek;
  document.getElementById("hdr-store").textContent = model.store ? model.store.name : "";
  document.getElementById("hdr-week").textContent = onPeriod
    ? rangeLabel(dashboardPeriod.from, dashboardPeriod.to) + " (période)"
    : weekTitle(viewedWeek?.semaine) + (route.name === "dashboard" && dashboardWeek ? " (consultee)" : "");

  if (route.name === "dashboard" && onPeriod && !periodWeek) {
    view.innerHTML = `<p class="empty-hint">Aucun relevé pour ${model.store?.name || "ce magasin"} sur cette période.<br>Choisissez-en une autre avec le calendrier.</p>`;
  } else if (route.name === "dashboard") {
    renderDashboard(view, model, settings, nav, viewedWeek, () => { dashboardPeriod = null; render(data); });
  } else if (route.name === "metric") {
    renderMetricDetail(view, model, route.key, settings);
    view.querySelector("[data-back]")?.addEventListener("click", () => nav("dashboard"));
  } else if (route.name === "stats") {
    renderStats(view, model.metrics, model.history, undefined, (data.generated_at || "").slice(0, 10));
  } else if (route.name === "trophies") {
    renderTrophies(view, model, settings);
  } else if (route.name === "settings") {
    renderSettings(view, { ...data, currentStoreName: model.store?.name, adminUnlocked: isAdminUnlocked(), role: roleSession }, settings, {
      setShape: (s) => { setSetting("shape", s); render(data); },
      setTheme: (t) => { setSetting("theme", t); applyTheme(); render(data); },
      changeStore: () => retourAdmin(data),
      save: () => nav("dashboard"),
      logout: () => logoutAdmin(),
    });
  }
}

loadData()
  .then(boot)
  .catch((err) => {
    app.innerHTML = `<div style="padding:40px 24px;color:var(--text-dim)">
      <h2 style="color:var(--text)">Donnees indisponibles</h2>
      <p style="margin-top:10px;">${err.message}</p>
    </div>`;
    console.error(err);
  });
