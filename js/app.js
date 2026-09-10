import { loadData, buildStoreModel } from "./data.js";
import { settings, setSetting } from "./state.js";
import { icon } from "./icons.js";
import {
  renderOnboarding,
  renderDashboard,
  renderMetricDetail,
  renderTrophies,
  renderSettings,
} from "./views.js";

const app = document.getElementById("app");

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

function weekTitle(model) {
  if (!model.currentWeek) return "";
  const s = model.currentWeek.semaine || "";
  const [, num] = s.split("-S");
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
      <button class="nav-btn" data-nav="trophies">${icon("trophy", 20)}<span>Trophees</span></button>
      <button class="nav-btn" data-nav="settings">${icon("gear", 20)}<span>Reglages</span></button>
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

  const start = () => {
    buildShell();
    render(data);
    window.addEventListener("hashchange", () => render(data));
  };

  if (!settings.storeCode || !data.stores.some((s) => s.code === settings.storeCode)) {
    showOnboarding(data, start);
  } else {
    start();
  }
}

function render(data) {
  const model = buildStoreModel(data, settings.storeCode);
  const route = parseRoute();
  const view = document.getElementById("view");
  view.innerHTML = "";

  document.getElementById("hdr-store").textContent = model.store ? model.store.name : "";
  document.getElementById("hdr-week").textContent = weekTitle(model);

  document.querySelectorAll(".nav-btn").forEach((b) => {
    const active = b.dataset.nav === (route.name === "metric" ? "dashboard" : route.name);
    b.classList.toggle("active", active);
  });

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
      changeStore: () => showOnboarding(data, () => { buildShell(); render(data); }),
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
