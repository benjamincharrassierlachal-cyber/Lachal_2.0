// Generation des anneaux SVG (cercle, pentagone, hexagone) partages par
// tout le visuel : cluster de la page d'accueil, mini-jauges des cartes.

import { iconInner } from "./icons.js";

const SIDES = { circle: 0, pentagon: 5, hexagon: 6 };

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
// (0-100, en repartant du sommet, sens horaire) : approxime la meme
// trajectoire que le trace du contour (suffisant pour placer une pastille).
function pointOnShape(shape, cx, cy, r, pct) {
  const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

// rings: tableau exterieur -> interieur de { pct, color, icon }
// icon (facultatif) : cle de icons.js, affichee en pastille au bout de
// l'anneau, comme les fleches de l'app Sante.
export function ringClusterSVG(size, rings, shape, opts) {
  const showIcons = !!(opts && opts.icons);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 6;
  const gap = maxR / (rings.length + 0.6);
  const strokeW = Math.max(6, gap * 0.62);

  let out = `<svg viewBox="0 0 ${size} ${size}" class="ring-cluster" data-shape="${shape}">`;
  out += `<defs><filter id="ringShadow" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#000" flood-opacity="0.6" />
  </filter></defs>`;

  const badges = [];

  rings.forEach((ring, i) => {
    const r = maxR - i * gap;
    const rawPct = ring.pct ?? 0;
    const pct = Math.max(0, Math.min(100, rawPct));
    out += shapeEl(shape, cx, cy, r, {
      fill: "none",
      stroke: "var(--track)",
      "stroke-width": strokeW,
      "stroke-linejoin": "round",
    });
    if (ring.pct !== null && ring.pct !== undefined) {
      out += shapeEl(shape, cx, cy, r, {
        fill: "none",
        stroke: ring.color,
        "stroke-width": strokeW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        pathLength: 100,
        "stroke-dasharray": `${pct} ${100 - pct}`,
        class: "ring-progress",
      });
    }
    if (rawPct > 100) {
      // deuxieme (ou N-ieme) tour : redessine par-dessus, avec une ombre
      // portee pour bien montrer qu'un tour complet a deja ete boucle.
      const overflowPct = Math.min(100, rawPct - 100);
      out += shapeEl(shape, cx, cy, r, {
        fill: "none",
        stroke: ring.color,
        "stroke-width": strokeW,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        pathLength: 100,
        "stroke-dasharray": `${overflowPct} ${100 - overflowPct}`,
        filter: "url(#ringShadow)",
        class: "ring-overflow",
      });
    }

    if (showIcons && ring.icon) {
      const tipPct = rawPct <= 0 ? 0 : ((rawPct - 0.001) % 100) + 0.001;
      const [tx, ty] = pointOnShape(shape, cx, cy, r, tipPct);
      badges.push({ tx, ty, color: ring.color, icon: ring.icon });
    }
  });

  // Les pastilles se dessinent apres coup pour rester au-dessus des anneaux.
  const D = Math.max(20, strokeW * 1.7);
  badges.forEach(({ tx, ty, color, icon }) => {
    const iconSize = D * 0.56;
    out += `<g>
      <circle cx="${tx}" cy="${ty}" r="${D / 2}" fill="${color}" stroke="var(--bg)" stroke-width="2" />
      <g transform="translate(${tx - iconSize / 2} ${ty - iconSize / 2}) scale(${iconSize / 24})" stroke="#0a0c11" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${iconInner(icon)}</g>
    </g>`;
  });

  out += "</svg>";
  return out;
}
