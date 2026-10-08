// Connexion unique Lachal 2.0 : le code (magasin ou admin) est saisi une fois
// sur la page d'accueil, puis "Suivi & Trophees" et "Stats" s'ouvrent sans
// redemander. Le code est verifie en ouvrant le fichier chiffre correspondant
// (stats/data/) ; seule la cle derivee est gardee sur l'appareil.

import { deriverCle, dechiffrer } from "../stats/js/crypto.js";

const KEY = "lachalAuth.v1";
const TMP = "lachalAuth.tmp";

// Les chemins se resolvent depuis ce fichier, donc depuis n'importe quelle page.
const url = (rel) => new URL(rel, import.meta.url).href;

function lire() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function ecrire(o) {
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* navigation privee */ }
}

export function lireSession() {
  try {
    const tmp = JSON.parse(sessionStorage.getItem(TMP) || "null");
    if (tmp) return tmp;
  } catch { /* rien */ }
  return lire().session || null;
}

function sauverSession(session, durable) {
  if (durable) ecrire({ ...lire(), session });
  else { try { sessionStorage.setItem(TMP, JSON.stringify(session)); } catch { /* rien */ } }
}

export function deconnecter() {
  const t = lire();
  delete t.session;
  ecrire(t);
  try { sessionStorage.removeItem(TMP); } catch { /* rien */ }
}

// Appareil affecte a un magasin (apres sa premiere connexion memorisee) : plus
// de choix d'un autre magasin ; seul l'admin peut le deverrouiller.
export function magasinVerrouille() {
  return lire().lockedStore || null;
}
export function deverrouiller() {
  const t = lire();
  delete t.lockedStore;
  ecrire(t);
}

export async function chargerManifest() {
  const r = await fetch(url("../stats/data/manifest.json"), { cache: "no-cache" });
  if (!r.ok) throw new Error("Liste des magasins introuvable (" + r.status + ")");
  return r.json();
}

async function chargerBlob(manifest, role, code) {
  const rel = role === "admin" ? "../stats/data/admin.json" : `../stats/data/s_${code}.json`;
  const r = await fetch(`${url(rel)}?v=${encodeURIComponent(manifest.genere)}`, { cache: "no-cache" });
  if (!r.ok) throw new Error("Donnees introuvables (" + r.status + ")");
  return r.json();
}

// Verifie un code saisi. Renvoie {ok:true, payload} ou {ok:false, msg}.
export async function connecter(manifest, { role, code, secret, remember }) {
  let blob;
  try {
    blob = await chargerBlob(manifest, role, code);
  } catch {
    return { ok: false, msg: "Impossible de charger les données. Vérifiez votre connexion." };
  }
  try {
    const cle = await deriverCle(secret, blob);
    const payload = await dechiffrer(blob, cle);
    sauverSession({ role, code, cle }, remember);
    if (role === "magasin" && remember) ecrire({ ...lire(), lockedStore: code });
    return { ok: true, payload };
  } catch {
    return { ok: false, msg: "Code incorrect." };
  }
}

// Session memorisee encore valable ? (le code a pu etre change depuis)
// Renvoie {role, code, cle, payload} ou null.
export async function verifierSession(manifest) {
  const s = lireSession();
  if (!s || !s.cle) return null;
  let blob;
  try {
    blob = await chargerBlob(manifest, s.role, s.code);
  } catch {
    return null; // probleme reseau : on ne deconnecte pas pour autant
  }
  try {
    return { ...s, payload: await dechiffrer(blob, s.cle) };
  } catch {
    deconnecter(); // la cle ne convient plus : le code a ete change
    return null;
  }
}
