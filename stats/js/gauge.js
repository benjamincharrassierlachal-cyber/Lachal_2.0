// Le "curseur de sante" : une piste coloree par zones (Fragile -> Excellent)
// avec un repere sur 100 (= le niveau de la reference) et un curseur qui
// glisse jusqu'au score. Echelle affichee : 70 a 130.

import { CAT, zoneFor, esc } from "./catalog.js";

const MIN = 70;
const MAX = 130;
const place = (s) => Math.max(0, Math.min(100, ((s - MIN) / (MAX - MIN)) * 100));

export function sliderHTML(score) {
  const bornes = [MIN, ...CAT.zones.map((z) => Math.min(z.max, MAX))];
  const segments = CAT.zones
    .map((z, i) => `<i style="width:${(place(bornes[i + 1]) - place(bornes[i])).toFixed(2)}%;background:${z.color}"></i>`)
    .join("");
  // Seuils chiffres aux frontieres des zones (les noms de zones, trop longs
  // pour tenir cote a cote sur un telephone, sont donnes au-dessus du curseur).
  const etiquettes = CAT.zones
    .slice(0, -1)
    .map((z) => `<span style="left:${place(z.max).toFixed(2)}%">${z.max}</span>`)
    .join("");
  const z = zoneFor(score);
  const aff = score === null || score === undefined ? "" : `
    <span class="st-slider-thumb" data-place="${place(score).toFixed(2)}" style="left:0%;--z:${z.color}">
      <b>${Math.round(score)}</b>
    </span>`;
  return `<div class="st-slider">
      <div class="st-slider-track">${segments}
        <span class="st-slider-target" style="left:${place(100).toFixed(2)}%"></span>${aff}
      </div>
      <div class="st-slider-labels">${etiquettes}</div>
      <div class="st-slider-scale"><span>${MIN}</span><span class="st-slider-cible" style="left:${place(100).toFixed(2)}%">▲ cible 100</span><span>${MAX}</span></div>
    </div>`;
}

// A appeler apres insertion dans le DOM : fait glisser le curseur.
export function animateSliders(root) {
  const thumbs = root.querySelectorAll(".st-slider-thumb");
  if (!thumbs.length) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => thumbs.forEach((t) => (t.style.left = t.dataset.place + "%")));
  });
}

export function scoreChip(score, extra = "") {
  if (score === null || score === undefined) return `<span class="st-score st-score--none ${extra}">–</span>`;
  const z = zoneFor(score);
  return `<span class="st-score ${extra}" style="--z:${z.color}" title="${esc(z.label)}">${Math.round(score)}</span>`;
}

// Barre empilee : nombre de magasins par zone.
export function zonesBar(zones, total) {
  const segs = CAT.zones
    .filter((z) => zones[z.key])
    .map((z) => `<i style="flex:${zones[z.key]};background:${z.color}" title="${esc(z.label)} : ${zones[z.key]}"></i>`)
    .join("");
  const legende = CAT.zones
    .filter((z) => zones[z.key])
    .map((z) => `<span><i style="background:${z.color}"></i>${esc(z.label)} <b>${zones[z.key]}</b></span>`)
    .join("");
  return `<div class="st-zonesbar">${segs}</div><div class="st-zones-legend">${legende}</div><span hidden>${total}</span>`;
}
