// Generation des anneaux SVG (cercle, pentagone, hexagone) partages par
// tout le visuel : cluster de la page d'accueil, mini-jauges des cartes.

import { iconInner } from "./icons.js";

const SIDES = { circle: 0, pentagon: 5, hexagon: 6 };
let gradSeq = 0;

function polygonPoints(cx, cy, r, sides) {
  const start = -Math.PI / 2;
  const step = (2 * Math.PI) / sides;
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = start + i * step;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts.map((p) => p.join(",")).join(" ");
}

function shapeEl(shape, cx, cy, r, extraAttrs) {
  const sides = SIDES[shape] ?? 6;
  const attrs = Object.entries(extraAttrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  if (sides === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" transform="rotate(-90 ${cx} ${cy})" ${attrs} />`;
  }
  return `<polygon points="${polygonPoints(cx, cy, r, sides)}" ${attrs} />`;
}

// Position sur le pourtour d'une forme reguliere pour un pourcentage donne
// (0-100, en repartant du sommet, sens horaire).
function pointOnShape(shape, cx, cy, r, pct) {
  const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

// Degrade le long de l'anneau, du plus terne (debut) au plus vif (le
// pourcentage courant) : x1/y1 -> x2/y2 suivent le trace, pas une simple
// diagonale du cadre.
function progressGradient(defs, cx, cy, r, shape, fromPct, toPct, color) {
  gradSeq += 1;
  const id = `rgrad${gradSeq}`;
  const [x1, y1] = pointOnShape(shape, cx, cy, r, fromPct);
  const [x2, y2] = pointOnShape(shape, cx, cy, r, toPct);
  defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    <stop offset="0%" stop-color="${color}" stop-opacity="0.3" />
    <stop offset="100%" stop-color="${color}" stop-opacity="1" />
  </linearGradient>`);
  return `url(#${id})`;
}

// rings: tableau exterieur -> interieur de { pct, color, icon }
// icon (facultatif) : cle de icons.js, affichee en pastille au bout de
// l'anneau, comme les fleches de l'app Sante. La pastille reste dans la
// largeur du trait (ne deborde pas dessus/dessous).
export function ringClusterSVG(size, rings, shape, opts) {
  const showIcons = !!(opts && opts.icons);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 6;
  const gap = maxR / (rings.length + 0.6);
  const strokeW = Math.max(6, gap * 0.62);

  const defs = [
    `<filter id="ringShadow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="1.3" stdDeviation="1.1" flood-color="#000" flood-opacity="0.65" />
    </filter>`,
  ];
  let body = "";
  const caps = [];
  const badges = [];

  rings.forEach((ring, i) => {
    const r = maxR - i * gap;
    const rawPct = ring.pct ?? 0;
    const pct = Math.max(0, Math.min(100, rawPct));

    body += shapeEl(shape, cx, cy, r, {
      fill: "none",
      stroke: "var(--track)",
      "stroke-width": strokeW,
      "stroke-linejoin": "round",
    });

    let tipPct = 0;
    if (ring.pct !== null && ring.pct !== undefined) {
      const stroke = progressGradient(defs, cx, cy, r, shape, 0, pct, ring.color);
      body += shapeEl(shape, cx, cy, r, {
        fill: "none",
        stroke,
        "stroke-width": strokeW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        pathLength: 100,
        "stroke-dasharray": `${pct} ${100 - pct}`,
        class: "ring-progress",
      });
      tipPct = pct;

      if (rawPct > 100) {
        const overflowPct = Math.min(100, rawPct - 100);
        const strokeOverflow = progressGradient(defs, cx, cy, r, shape, 0, overflowPct, ring.color);
        body += shapeEl(shape, cx, cy, r, {
          fill: "none",
          stroke: strokeOverflow,
          "stroke-width": strokeW,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          pathLength: 100,
          "stroke-dasharray": `${overflowPct} ${100 - overflowPct}`,
          class: "ring-overflow",
        });
        tipPct = overflowPct;
      }
    }

    // Ombre sous le bout de fin (pas au depart) : petit disque au point
    // courant, avec une ombre portee, pour donner du relief a la pointe.
    if (rawPct > 0) {
      const [tx, ty] = pointOnShape(shape, cx, cy, r, tipPct);
      caps.push({ tx, ty, radius: strokeW / 2, color: ring.color });
    }

    if (showIcons && ring.icon) {
      const atPct = rawPct > 0 ? tipPct : 0;
      const [tx, ty] = pointOnShape(shape, cx, cy, r, atPct);
      badges.push({ tx, ty, color: ring.color, icon: ring.icon });
    }
  });

  caps.forEach(({ tx, ty, radius, color }) => {
    body += `<circle cx="${tx}" cy="${ty}" r="${radius}" fill="${color}" filter="url(#ringShadow)" />`;
  });

  // Pastilles d'icone : diametre cale sur l'epaisseur du trait, jamais plus
  // large, pour ne pas deborder de la bande de l'anneau.
  const D = strokeW;
  badges.forEach(({ tx, ty, color, icon }) => {
    const iconSize = D * 0.58;
    body += `<g>
      <circle cx="${tx}" cy="${ty}" r="${D / 2}" fill="${color}" />
      <g transform="translate(${tx - iconSize / 2} ${ty - iconSize / 2}) scale(${iconSize / 24})" stroke="#0a0c11" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${iconInner(icon)}</g>
    </g>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" class="ring-cluster" data-shape="${shape}"><defs>${defs.join("")}</defs>${body}</svg>`;
}
