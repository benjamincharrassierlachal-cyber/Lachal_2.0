// Contexte de consultation : groupe -> magasin -> collaborateur. Chaque niveau
// se compare a l'instance superieure (reference). Aucun calcul de score ici :
// il est fait a la construction des donnees (build_stats.py), on ne fait que
// lire, regrouper et reperer forces / points d'attention.

import { CAT, fmtEvol, fmtValue, zoneFor } from "./catalog.js";

const moyenne = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Sante du reseau principal : moyenne des scores des magasins, par pilier, et
// repartition des magasins par zone.
export function santeGroupe(payload) {
  const magasins = payload.magasins.filter((m) => m.sante && m.kind === "full");
  if (!magasins.length) return null;
  const score = moyenne(magasins.map((m) => m.sante.score));
  const piliers = {};
  CAT.pillars.forEach((p) => {
    const xs = magasins.map((m) => m.sante.piliers[p.key]).filter((x) => x !== undefined);
    if (xs.length) piliers[p.key] = moyenne(xs);
  });
  const zones = Object.fromEntries(CAT.zones.map((z) => [z.key, 0]));
  magasins.forEach((m) => (zones[m.sante.zone] += 1));
  return { score: Math.round(score * 10) / 10, piliers, zone: zoneFor(score).key, zones, count: magasins.length };
}

function histGroupe(payload) {
  const parDate = {};
  payload.magasins.forEach((m) => {
    if (m.kind !== "full") return;
    (m.hist || []).forEach((h) => {
      if (h.ca === null || h.ca === undefined) return;
      parDate[h.s] = (parDate[h.s] || 0) + h.ca;
    });
  });
  return Object.keys(parDate).sort().map((s) => ({ s, ca: parDate[s], score: null }));
}

export function buildContext(payload, nav) {
  const base = { payload, ix: payload._ix };
  if (!nav.store) {
    const g = payload.groupe;
    return {
      ...base, level: "group", name: "Groupe", kind: "full",
      ent: { v: g.v, e: g.e, compta: g.compta, hist: histGroupe(payload) },
      ref: null, refLabel: null, sante: santeGroupe(payload), rang: null,
      children: payload.magasins, dist: payload.dist,
    };
  }
  const store = payload.magasins.find((m) => m.code === nav.store) || payload.magasins[0];
  const o2 = store.kind === "o2000";
  const refSrc = o2 ? payload.groupe_o2000 : payload.groupe;
  if (!nav.seller) {
    return {
      ...base, level: "store", name: store.nom, kind: store.kind, store,
      ent: store,
      ref: store.kind === "ca" ? null : { v: refSrc.v, e: refSrc.e },
      refLabel: o2 ? "le Groupe Optic 2000" : "tous les magasins",
      refDe: o2 ? "du Groupe Optic 2000" : "de tous les magasins",
      refA: o2 ? "au Groupe Optic 2000" : "à tous les magasins",
      partDe: o2 ? "du Groupe Optic 2000" : "du réseau",
      sante: store.sante, rang: store.rang || null,
      children: store.vendeurs.filter((s) => !s.masque), dist: o2 ? null : payload.dist,
    };
  }
  const seller = store.vendeurs.find((s) => s.nom === nav.seller) || store.vendeurs[0];
  return {
    ...base, level: "seller", name: seller.nom, kind: store.kind, store,
    ent: seller, ref: { v: store.v, e: store.e }, refLabel: "son magasin", refDe: "de son magasin", refA: "à son magasin",
    partDe: "du magasin",
    sante: seller.sante, rang: seller.rang || null, children: [], dist: null,
  };
}

// Position d'une valeur parmi les magasins du reseau (min / mediane / max).
export function positionDansDist(arr, v) {
  if (!arr || v === null || v === undefined) return null;
  const min = arr[0];
  const max = arr[arr.length - 1];
  const med = arr[Math.floor(arr.length / 2)];
  const span = max - min;
  const place = (x) => (span > 0 ? Math.max(0, Math.min(1, (x - min) / span)) : 0.5);
  const dessous = arr.filter((x) => x < v).length;
  return { min, max, med, pos: place(v), posMed: place(med), centile: Math.round((dessous / arr.length) * 100) };
}

// Libelle / valeur / reference d'un indicateur du score de sante.
export function decrire(ctx, key) {
  const k = CAT.byKey[key];
  const i = ctx.ix[key];
  if (key === "CA") {
    return { label: "Croissance du CA", valeur: fmtEvol("pct", ctx.ent.e[i]), ref: fmtEvol("pct", ctx.ref.e[i]) };
  }
  return { label: k.label, valeur: fmtValue(k.fmt, ctx.ent.v[i]), ref: fmtValue(k.fmt, ctx.ref.v[i]) };
}

export function forcesEtFaiblesses(ctx) {
  const idx = ctx.sante && ctx.sante.idx;
  if (!idx || !ctx.ref) return { forces: [], faibles: [] };
  const lignes = Object.entries(idx).map(([key, i]) => ({ key, idx: i, ...decrire(ctx, key) }));
  lignes.sort((a, b) => b.idx - a.idx);
  return {
    forces: lignes.filter((l) => l.idx >= 102).slice(0, 3),
    faibles: lignes.filter((l) => l.idx <= 98).slice(-3).reverse(),
  };
}
