// Catalogue des indicateurs (kpis.json) + mise en forme des valeurs.
// Les donnees chiffrees ne contiennent que des tableaux de nombres alignes
// sur la liste `kpis` du fichier : c'est ici qu'on retrouve libelles, formats
// et sens "bon / mauvais".

export const CAT = { kpis: [], byKey: {}, groups: [], pillars: [], zones: [], health: {} };

export async function loadCatalog() {
  const r = await fetch("kpis.json", { cache: "no-cache" });
  if (!r.ok) throw new Error("kpis.json introuvable (" + r.status + ")");
  const d = await r.json();
  CAT.kpis = d.kpis;
  CAT.groups = d.groups;
  CAT.pillars = d.pillars;
  CAT.zones = d.zones;
  CAT.health = d.health;
  CAT.byKey = Object.fromEntries(d.kpis.map((k) => [k.key, k]));
  return CAT;
}

// {cle d'indicateur -> position dans les tableaux v / e}
export function indexOf(payload) {
  if (!payload._ix) payload._ix = Object.fromEntries(payload.kpis.map((k, i) => [k, i]));
  return payload._ix;
}

export function zoneFor(score) {
  if (score === null || score === undefined) return null;
  return CAT.zones.find((z) => score < z.max) || CAT.zones[CAT.zones.length - 1];
}

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const num0 = (v) => nf0.format(v);
export const num1 = (v) => nf1.format(v);

const signe = (txt, v) => (v > 0 ? "+" + txt : txt);

export function fmtValue(fmt, v) {
  if (v === null || v === undefined) return "–";
  if (fmt === "eur") return nf0.format(v) + " €";
  if (fmt === "pct") return nf1.format(v * 100) + " %";
  if (fmt === "int") return nf0.format(v);
  return nf1.format(v);
}

// Ecart N-1 selon la nature de l'indicateur : variation en % (pct), ecart de
// taux en points (pts) ou ecart brut (abs).
export function fmtEvol(kind, e, fmt) {
  if (e === null || e === undefined || !kind) return null;
  if (kind === "pct") return signe(nf1.format(e * 100), e) + " %";
  if (kind === "pts") return signe(nf1.format(e * 100), e) + " pt";
  return signe(fmt === "eur" ? nf0.format(e) + " €" : nf0.format(e), e);
}

// Ecart relatif a une reference : points pour un taux, % sinon.
export function fmtVsRef(fmt, v, ref) {
  if (v === null || v === undefined || ref === null || ref === undefined) return null;
  if (fmt === "pct") return signe(nf1.format((v - ref) * 100), v - ref) + " pt";
  if (!ref) return null;
  const rel = (v - ref) / ref;
  return signe(nf0.format(rel * 100), rel) + " %";
}

// Les taux et les prix moyens se comparent a la reference (moyenne) ; les
// volumes (CA, nombres de ventes...) non : un magasin n'a pas a "battre" le
// CA total du groupe. Pour eux on affiche la part du total.
export function estComparable(kpi) {
  return kpi.fmt === "pct" || kpi.key.startsWith("PM_");
}

// {txt, tone} a afficher a cote d'une valeur, ou null.
export function compareRef(kpi, v, ref, partDe) {
  if (v === null || v === undefined || ref === null || ref === undefined) return null;
  if (estComparable(kpi)) {
    const txt = fmtVsRef(kpi.fmt, v, ref);
    return txt ? { txt, tone: tone(kpi, v - ref), ref: true } : null;
  }
  if (ref > 0 && v >= 0) {
    return { txt: `${nf1.format((v / ref) * 100)} % ${partDe || "du total"}`, tone: "flat", ref: false };
  }
  return null;
}

// good / bad / flat : un ecart est "bon" selon le sens de l'indicateur ; les
// indicateurs sans jugement restent neutres, sauf les volumes (CA, nombres)
// pour lesquels plus = mieux.
export function tone(kpi, delta) {
  if (delta === null || delta === undefined || Math.abs(delta) < 1e-9) return "flat";
  let sens = kpi.polarity;
  if (sens === "none") {
    const volume = kpi.fmt === "int" || kpi.key === "CA" || kpi.key === "CA_Contacto" || kpi.fmt === "dec";
    if (!volume) return "flat";
    sens = "up";
  }
  const bon = sens === "down" ? delta < 0 : delta > 0;
  return bon ? "good" : "bad";
}

// Variation relative comparable d'un indicateur a l'autre (pour classer les
// plus fortes hausses / baisses vs N-1).
export function relEvol(kpi, v, e) {
  if (e === null || e === undefined) return null;
  const k = kpi.evol && kpi.evol.kind;
  if (k === "pct" || k === "pts") return e;
  if (v === null || v === undefined || v - e === 0) return null;
  return e / (v - e);
}

// Valeur de la periode N-1 reconstituee a partir de la valeur et de l'ecart.
export function valeurN1(kpi, v, e) {
  if (v === null || v === undefined || e === null || e === undefined || !kpi.evol) return null;
  if (kpi.evol.kind === "pct") return 1 + e !== 0 ? v / (1 + e) : null;
  return v - e; // points ou ecart brut
}

export function pillarColor(key) {
  return { croissance: "var(--c-avis)", transition: "var(--c-examens)", valeur: "var(--c-impr)", verres: "var(--c-p4)" }[key] || "var(--c-avis)";
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function fmtDateFr(iso, court) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const mois = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return court ? `${d} ${mois[m - 1]}` : `${d} ${mois[m - 1]} ${y}`;
}
