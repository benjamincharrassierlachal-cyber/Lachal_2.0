// Petite boite a outils de graphiques (SVG / HTML, sans dependance) pour la
// page Chiffres : jauges en arc, donuts, barres N-1 / N, barres "bullet",
// colonnes, barres empilees. Les animations (remplissage, compteurs) se
// declenchent avec animerGraphiques() une fois le HTML insere dans la page.

import { esc, fmtValue, fmtEvol, tone } from "./catalog.js";

const borne = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

export function chipEvol(kpi, e) {
  const txt = kpi.evol ? fmtEvol(kpi.evol.kind, e, kpi.fmt) : null;
  return txt ? `<span class="st-chip st-chip--${tone(kpi, e)}">${txt} <em>N-1</em></span>` : "";
}

// ------------------------------------------------------------- jauge en arc
// value / ref / max dans la meme unite ; le trait blanc marque la reference.
export function arcGauge({ value, ref, max, color, label, fmt, chip = "" }) {
  const frac = borne(value / max);
  const R = 50, cx = 60, cy = 62;
  const arc = `M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`;
  let tick = "";
  if (ref !== null && ref !== undefined) {
    const th = Math.PI * (1 - borne(ref / max));
    const p = (r) => `${(cx + r * Math.cos(th)).toFixed(1)}`;
    const q = (r) => `${(cy - r * Math.sin(th)).toFixed(1)}`;
    tick = `<line x1="${p(R - 10)}" y1="${q(R - 10)}" x2="${p(R + 9)}" y2="${q(R + 9)}" stroke="var(--text)" stroke-width="2.6" stroke-linecap="round"><title>Référence</title></line>`;
  }
  return `<div class="st-arc">
      <svg viewBox="0 0 120 72" aria-hidden="true">
        <path d="${arc}" fill="none" stroke="var(--track)" stroke-width="11" stroke-linecap="round"/>
        <path d="${arc}" pathLength="100" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="0 100" data-dash="${(frac * 100).toFixed(1)} ${(100 - frac * 100).toFixed(1)}" class="st-anim-arc"/>
        ${tick}
      </svg>
      <div class="st-arc-val" style="color:${color}">${fmtValue(fmt, value)}</div>
      <div class="st-arc-label">${esc(label)}</div>
      ${chip}
    </div>`;
}

// ------------------------------------------------------------------- donut
// parts : [{label, value, color, extra}] ; centre : texte au milieu.
export function donut(parts, { centre = "", sousCentre = "" } = {}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (total <= 0) return "";
  let cum = 0;
  const segs = parts.map((p) => {
    const pct = (p.value / total) * 100;
    const s = `<circle cx="60" cy="60" r="40" fill="none" stroke="${p.color}" stroke-width="17" pathLength="100"
        stroke-dasharray="0 100" data-dash="${Math.max(0, pct - 0.6).toFixed(2)} ${(100 - Math.max(0, pct - 0.6)).toFixed(2)}"
        stroke-dashoffset="${(-cum).toFixed(2)}" transform="rotate(-90 60 60)" class="st-anim-arc"/>`;
    cum += pct;
    return s;
  }).join("");
  const legende = parts.map((p) => `<div class="st-leg-row">
      <i style="background:${p.color}"></i><span class="st-leg-name">${esc(p.label)}</span>
      <b>${((p.value / total) * 100).toFixed(1).replace(".", ",")} %</b>${p.extra ? `<span class="st-leg-extra">${p.extra}</span>` : ""}</div>`).join("");
  return `<div class="st-donut-wrap">
      <div class="st-donut"><svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="40" fill="none" stroke="var(--track)" stroke-width="17"/>${segs}</svg>
        <div class="st-donut-centre"><strong>${centre}</strong><small>${esc(sousCentre)}</small></div></div>
      <div class="st-legend-col">${legende}</div></div>`;
}

// ---------------------------------------------------------- barre empilee
export function stackedBar(parts, { titre = "" } = {}) {
  const utiles = parts.filter((p) => p.value > 0);
  const total = utiles.reduce((a, p) => a + p.value, 0);
  if (!total) return "";
  return `${titre ? `<div class="st-mini-title">${esc(titre)}</div>` : ""}
    <div class="st-stack">${utiles.map((p) => `<i style="flex:${p.value};background:${p.color}" title="${esc(p.label)}"></i>`).join("")}</div>
    <div class="st-stack-legend">${utiles.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.label)} <b>${((p.value / total) * 100).toFixed(1).replace(".", ",")} %</b></span>`).join("")}</div>`;
}

// ------------------------------------------------------- barres N-1 / N
export function pairBars({ cur, prev, fmt, color }) {
  const max = Math.max(cur, prev ?? 0, 1e-9);
  const barre = (v, c, cls) => `<div class="st-pair-row ${cls}">
      <div class="st-pair-track"><i style="background:${c}" data-w="${((v / max) * 100).toFixed(1)}" class="st-anim-bar"></i></div>
      <span>${fmtValue(fmt, v)}</span></div>`;
  return `<div class="st-pair">
      ${prev !== null && prev !== undefined ? `<div class="st-pair-tag">N-1</div>${barre(prev, "var(--text-faint)", "st-pair-prev")}` : ""}
      <div class="st-pair-tag">N</div>${barre(cur, color, "st-pair-cur")}</div>`;
}

// -------------------------------------------------------------- bullet
// Barre de 0 (ou du mini du reseau) jusqu'a la valeur ; trait = reference ;
// rond creux = N-1.
export function bullet({ value, ref, prev, min, max, fmt, color, bornes = false }) {
  const span = max - min || 1;
  const pos = (x) => (borne((x - min) / span) * 100).toFixed(1);
  return `<div class="st-bullet">
      <div class="st-bullet-track">
        <i class="st-anim-bar" style="background:${color}" data-w="${pos(value)}"></i>
        ${ref !== null && ref !== undefined ? `<span class="st-bullet-ref" style="left:${pos(ref)}%" title="Référence"></span>` : ""}
        ${prev !== null && prev !== undefined ? `<span class="st-bullet-prev" style="left:${pos(prev)}%" title="N-1"></span>` : ""}
      </div>
      ${bornes ? `<div class="st-bullet-scale"><span>${fmtValue(fmt, min)}</span><span>${fmtValue(fmt, max)}</span></div>` : ""}
    </div>`;
}

// ------------------------------------------------------------- colonnes
export function columns(items, { fmt, color }) {
  const max = Math.max(...items.map((x) => Math.max(x.cur, x.prev ?? 0)), 1e-9);
  return `<div class="st-cols">${items.map((x) => `<div class="st-col">
      <div class="st-col-val">${fmtValue(fmt, x.cur)}</div>
      <div class="st-col-bars">
        ${x.prev !== null && x.prev !== undefined ? `<i class="st-col-prev st-anim-barv" data-h="${((x.prev / max) * 100).toFixed(1)}"></i>` : ""}
        <i class="st-col-cur st-anim-barv" style="background:${color}" data-h="${((x.cur / max) * 100).toFixed(1)}"></i>
      </div>
      <div class="st-col-label">${esc(x.label)}</div>
      ${x.chip || ""}</div>`).join("")}</div>`;
}

// ---------------------------------------------------- animations (apres insertion)
export function animerGraphiques(racine) {
  const arcs = racine.querySelectorAll(".st-anim-arc");
  const barres = racine.querySelectorAll(".st-anim-bar");
  const verticales = racine.querySelectorAll(".st-anim-barv");
  const compteurs = racine.querySelectorAll("[data-count]");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      arcs.forEach((a) => a.setAttribute("stroke-dasharray", a.dataset.dash));
      barres.forEach((b) => (b.style.width = b.dataset.w + "%"));
      verticales.forEach((b) => (b.style.height = b.dataset.h + "%"));
    });
  });
  compteurs.forEach((el) => {
    const cible = Number(el.dataset.count);
    const fmt = el.dataset.fmt;
    const debut = performance.now();
    const duree = 900;
    const pas = (t) => {
      const f = Math.min(1, (t - debut) / duree);
      const e = 1 - Math.pow(1 - f, 3);
      el.textContent = fmtValue(fmt, cible * e);
      if (f < 1) requestAnimationFrame(pas);
      else el.textContent = fmtValue(fmt, cible);
    };
    requestAnimationFrame(pas);
  });
}
