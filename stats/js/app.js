import { loadCatalog, indexOf, fmtDateFr, esc } from "./catalog.js";
import { deriverCle, dechiffrer } from "./crypto.js";
import { buildContext } from "./model.js";
import { icon } from "./icons.js";
import { renderLogin, renderHome, renderTeam, renderEvolution, renderSettings } from "./views.js";
import { renderIndicators } from "./chiffres.js";

const app = document.getElementById("app");

// ---------------------------------------------------------------- stockage
const KEY = "statsApp.v1";
const lire = () => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };
const ecrire = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* navigation privee */ } };
const prefs = { theme: "aurora", shape: "hexagon", ...(lire().prefs || {}) };

function setPref(k, v) {
  prefs[k] = v;
  ecrire({ ...lire(), prefs });
}

// Session : cle derivee memorisee sur l'appareil (localStorage) ou, si
// "Memoriser" est decoche, seulement pour l'onglet (sessionStorage).
function lireSession() {
  try {
    const tmp = JSON.parse(sessionStorage.getItem("statsApp.tmp") || "null");
    return tmp || lire().session || null;
  } catch { return lire().session || null; }
}
function sauverSession(s, durable) {
  if (durable) {
    ecrire({ ...lire(), session: s });
  } else {
    try { sessionStorage.setItem("statsApp.tmp", JSON.stringify(s)); } catch { /* rien */ }
  }
}
function oublierCle() {
  const tout = lire();
  if (tout.session) tout.session = { role: tout.session.role, code: tout.session.code };
  ecrire(tout);
  try { sessionStorage.removeItem("statsApp.tmp"); } catch { /* rien */ }
}

// ------------------------------------------------------------------- etat
const S = { manifest: null, payload: null, role: null, nav: { store: null, seller: null }, sort: "score", zone: null };

function applyTheme() {
  document.documentElement.setAttribute("data-theme", prefs.theme);
}

async function chargerBlob(role, code) {
  const url = role === "admin" ? "data/admin.json" : `data/s_${code}.json`;
  const r = await fetch(`${url}?v=${encodeURIComponent(S.manifest.genere)}`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Données introuvables (" + r.status + ")");
  return r.json();
}

async function ouvrir(role, code, cleB64, blob) {
  const b = blob || (await chargerBlob(role, code));
  const payload = await dechiffrer(b, cleB64);
  indexOf(payload);
  S.payload = payload;
  S.role = role;
  S.nav = { store: role === "magasin" ? payload.magasins[0].code : null, seller: null };
  S.sort = "score";
  S.zone = null;
}

async function tenterConnexion({ role, code, secret, remember }) {
  let blob;
  try {
    blob = await chargerBlob(role, code);
  } catch (e) {
    return { ok: false, msg: "Impossible de charger les données. Vérifiez votre connexion." };
  }
  try {
    const cle = await deriverCle(secret, blob);
    await ouvrir(role, code, cle, blob);
    sauverSession({ role, code, cle }, remember);
    // Appareil affecte a ce magasin : plus de changement de magasin possible
    // (hors admin) ; l'admin le deverrouille depuis les Reglages.
    if (role === "magasin" && remember) setPref("lockedStore", code);
    demarrer();
    return { ok: true };
  } catch {
    return { ok: false, msg: "Code incorrect." };
  }
}

function magasinVerrouille() {
  if (!prefs.lockedStore) return null;
  const m = S.manifest.magasins.find((x) => x.code === prefs.lockedStore);
  return m ? { code: m.code, nom: m.nom } : null;
}

function afficherLogin(prefill, erreur) {
  app.innerHTML = "";
  renderLogin(app, S.manifest, {
    role: prefill && prefill.role, code: prefill && prefill.code, error: erreur, locked: magasinVerrouille(),
  }, tenterConnexion);
}

function deconnecter() {
  oublierCle();
  S.payload = null;
  location.hash = "";
  afficherLogin(lireSession());
}

// Admin uniquement (la page Reglages n'offre ce bouton qu'a lui).
function deverrouiller() {
  if (S.role !== "admin") return;
  setPref("lockedStore", null);
  deconnecter();
}

// ---------------------------------------------------------------- navigation
const TABS = [
  { key: "home", label: "Santé", icon: "pulse" },
  { key: "ind", label: "Chiffres", icon: "bars" },
  { key: "team", label: "Équipe", icon: "users" },
  { key: "evo", label: "Évolution", icon: "trending" },
];

function route() {
  const h = location.hash.replace(/^#\/?/, "");
  return ["home", "ind", "team", "evo", "settings"].includes(h) ? h : "home";
}

function aller(tab) {
  if (location.hash.replace(/^#\/?/, "") === tab) render();
  else location.hash = tab;
}

function ouvrirMagasin(code) {
  S.nav = { store: code, seller: null };
  S.zone = null;
  window.scrollTo(0, 0);
  aller("home");
  render();
}

function ouvrirVendeur(nom) {
  S.nav = { ...S.nav, seller: nom };
  window.scrollTo(0, 0);
  aller("home");
  render();
}

function monter() {
  if (S.nav.seller) S.nav = { ...S.nav, seller: null };
  else if (S.role === "admin") S.nav = { store: null, seller: null };
  window.scrollTo(0, 0);
  aller("home");
  render();
}

function peutMonter() {
  return !!S.nav.seller || (S.role === "admin" && !!S.nav.store);
}

function demarrer() {
  applyTheme();
  app.innerHTML = `
    <header class="app-header">
      <div class="st-title-wrap">
        <button class="icon-btn" id="hdr-back" hidden>${icon("chevronLeft", 20)}</button>
        <div><div class="store-name" id="hdr-name"></div><div class="week-label" id="hdr-sub"></div></div>
      </div>
      <div class="header-actions"><button class="icon-btn" id="hdr-settings">${icon("gear", 20)}</button></div>
    </header>
    <div class="st-crumbs" id="crumbs" hidden></div>
    <main id="view"></main>
    <nav class="bottom-nav">
      ${TABS.map((t) => `<button class="nav-btn" data-tab="${t.key}">${icon(t.icon, 20)}<span>${t.label}</span></button>`).join("")}
    </nav>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => aller(b.dataset.tab)));
  document.getElementById("hdr-settings").addEventListener("click", () => aller("settings"));
  document.getElementById("hdr-back").addEventListener("click", monter);
  if (!demarrer.ecoute) {
    demarrer.ecoute = true;
    window.addEventListener("hashchange", () => S.payload && render());
  }
  if (!location.hash) location.hash = "home";
  render();
}

function fil(ctx) {
  const parts = [];
  if (S.role === "admin") parts.push({ nom: "Groupe", f: () => { S.nav = { store: null, seller: null }; aller("home"); render(); } });
  if (S.nav.store) parts.push({ nom: ctx.store ? ctx.store.nom : "", f: () => { S.nav = { ...S.nav, seller: null }; aller("home"); render(); } });
  if (S.nav.seller) parts.push({ nom: S.nav.seller, f: null });
  return parts;
}

function render() {
  const tab = route();
  const ctx = buildContext(S.payload, S.nav);
  const view = document.getElementById("view");
  view.innerHTML = "";

  document.getElementById("hdr-name").textContent = ctx.name;
  const p = S.payload.periode;
  document.getElementById("hdr-sub").textContent = `Cumul au ${fmtDateFr(p.fin)}`;
  document.getElementById("hdr-back").hidden = !peutMonter();

  const crumbs = document.getElementById("crumbs");
  const chemin = fil(ctx);
  crumbs.hidden = chemin.length < 2;
  crumbs.innerHTML = chemin.map((c, i) => c.f ? `<button data-c="${i}">${esc(c.nom)}</button>` : `<span>${esc(c.nom)}</span>`).join(`<i>›</i>`);
  crumbs.querySelectorAll("[data-c]").forEach((b) => b.addEventListener("click", chemin[Number(b.dataset.c)].f));

  const labelEquipe = ctx.level === "group" ? "Magasins" : "Équipe";
  app.querySelectorAll("[data-tab]").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
    if (b.dataset.tab === "team") {
      b.hidden = ctx.level === "seller";
      b.querySelector("span").textContent = labelEquipe;
    }
  });
  if (tab === "team" && ctx.level === "seller") { aller("home"); return; }

  const h = { shape: prefs.shape, openStore: ouvrirMagasin, openSeller: ouvrirVendeur };
  if (tab === "home") renderHome(view, ctx, h);
  else if (tab === "ind") renderIndicators(view, ctx);
  else if (tab === "team") {
    renderTeam(view, ctx, h, {
      sort: S.sort, zone: S.zone,
      setSort: (s) => { S.sort = s; render(); },
      setZone: (z) => { S.zone = z; render(); },
    });
  } else if (tab === "evo") renderEvolution(view, ctx);
  else if (tab === "settings") {
    renderSettings(view, {
      shape: prefs.shape, theme: prefs.theme, periode: p, nbExports: S.payload.snapshots.length,
      qui: S.role === "admin" ? "Espace admin" : S.payload.magasins[0].nom,
      role: S.role, locked: magasinVerrouille(),
    }, {
      setShape: (s) => { setPref("shape", s); render(); },
      setTheme: (t) => { setPref("theme", t); applyTheme(); render(); },
      logout: deconnecter,
      unlock: deverrouiller,
    });
  }
}

// -------------------------------------------------------------------- boot
async function boot() {
  applyTheme();
  if (typeof DecompressionStream === "undefined" || !window.crypto || !crypto.subtle) {
    app.innerHTML = `<div style="padding:40px 24px;color:var(--text-dim)"><h2 style="color:var(--text)">Navigateur trop ancien</h2>
      <p style="margin-top:10px">Cette appli a besoin d'un navigateur récent (Safari 16.4 ou plus, Chrome, Edge) et d'une connexion sécurisée (https). Mettez votre appareil à jour.</p></div>`;
    return;
  }
  try {
    await loadCatalog();
    const r = await fetch("data/manifest.json", { cache: "no-cache" });
    if (!r.ok) throw new Error("manifest introuvable (" + r.status + ")");
    S.manifest = await r.json();
  } catch (e) {
    app.innerHTML = `<div style="padding:40px 24px;color:var(--text-dim)"><h2 style="color:var(--text)">Données indisponibles</h2><p style="margin-top:10px">${esc(e.message)}</p></div>`;
    return;
  }
  const s = lireSession();
  if (s && s.cle) {
    try {
      await ouvrir(s.role, s.code, s.cle);
      demarrer();
      return;
    } catch {
      // cle obsolete (code change) : on redemande le code
      oublierCle();
      afficherLogin(s, "Le code d'accès a changé : saisissez-le à nouveau.");
      return;
    }
  }
  afficherLogin(s);
}

boot();
