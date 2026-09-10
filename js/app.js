import { loadData, buildStoreModel, buildAdminModel, ADMIN_CODE } from "./data.js";
import { settings, setSetting, recordVisit, claimedBadges, claimBadge, resetClaimed } from "./state.js";
import { icon } from "./icons.js";
import { buildBadges } from "./badges.js";
import {
  renderOnboarding,
  renderRewards,
  renderDashboard,
  renderAdmin,
  renderMetricDetail,
  renderTrophies,
  renderSettings,
} from "./views.js";

const app = document.getElementById("app");

function isAdmin() {
  return settings.storeCode === ADMIN_CODE;
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", settings.theme);
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, "");
  if (hash.startsWith("metric-")) return { name: "metric", key: hash.slice(7) };
  if (hash === "trophies") return { name: "trophies" };
  if (hash === "settings") return { name: "settings" };
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

function buildShell() {
  app.innerHTML = `
    <header class="app-header">
      <div>
        <div class="store-name" id="hdr-store"></div>
        <div class="week-label" id="hdr-week"></div>
      </div>
      <button class="icon-btn" id="hdr-settings">${icon("gear", 20)}</button>
    </header>
    <main id="view"></main>
    <nav class="bottom-nav">
      <button class="nav-btn" data-nav="dashboard">${icon("home", 20)}<span>Accueil</span></button>
      ${isAdmin() ? "" : `<button class="nav-btn" data-nav="trophies">${icon("trophy", 20)}<span>Trophees</span></button>`}
    </nav>
  `;
  app.querySelectorAll("[data-nav]").forEach((b) =>
    b.addEventListener("click", () => nav(b.dataset.nav))
  );
  document.getElementById("hdr-settings").addEventListener("click", () => nav("settings"));
}

function showOnboarding(data, onDone) {
  app.innerHTML = "";
  renderOnboarding(app, data, (code) => {
    setSetting("storeCode", code);
    onDone();
  });
}

function boot(data) {
  applyTheme();
  recordVisit();

  const enterApp = () => checkRewards(data);
  const validStore = settings.storeCode === ADMIN_CODE || data.stores.some((s) => s.code === settings.storeCode);

  if (!settings.storeCode || !validStore) {
    showOnboarding(data, enterApp);
  } else {
    enterApp();
  }
}

function enterDashboard(data) {
  buildShell();
  render(data);
  window.addEventListener("hashchange", () => render(data));
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
    const adminModel = buildAdminModel(data);
    document.getElementById("hdr-store").textContent = "ADMIN";
    document.getElementById("hdr-week").textContent = weekTitle(adminModel.weekLabel);

    if (route.name === "settings") {
      renderSettings(view, { ...data, currentStoreName: "Espace admin" }, settings, {
        setShape: (s) => { setSetting("shape", s); render(data); },
        setTheme: (t) => { setSetting("theme", t); applyTheme(); render(data); },
        changeStore: () => showOnboarding(data, () => checkRewards(data)),
        save: () => nav("dashboard"),
        resetBadges: () => { resetClaimed(settings.storeCode); render(data); },
      });
    } else {
      const rows = adminModel.perStore
        .map((model) => {
          const badges = buildBadges(model, settings.visits);
          return { store: model.store, model, trophies: { unlocked: badges.filter((b) => b.unlocked).length, total: badges.length } };
        })
        .sort((a, b) => (b.model.currentWeek?.score ?? -1) - (a.model.currentWeek?.score ?? -1));
      renderAdmin(view, adminModel, settings, rows);
    }
    return;
  }

  const model = buildStoreModel(data, settings.storeCode);
  document.getElementById("hdr-store").textContent = model.store ? model.store.name : "";
  document.getElementById("hdr-week").textContent = weekTitle(model.currentWeek?.semaine);

  if (route.name === "dashboard") {
    renderDashboard(view, model, settings, nav);
  } else if (route.name === "metric") {
    renderMetricDetail(view, model, route.key, settings);
    view.querySelector("[data-back]")?.addEventListener("click", () => nav("dashboard"));
  } else if (route.name === "trophies") {
    renderTrophies(view, model, settings);
  } else if (route.name === "settings") {
    renderSettings(view, { ...data, currentStoreName: model.store?.name }, settings, {
      setShape: (s) => { setSetting("shape", s); render(data); },
      setTheme: (t) => { setSetting("theme", t); applyTheme(); render(data); },
      changeStore: () => showOnboarding(data, () => checkRewards(data)),
      save: () => nav("dashboard"),
      resetBadges: () => { resetClaimed(settings.storeCode); render(data); },
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
