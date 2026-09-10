// Generation des anneaux SVG (cercle, pentagone, hexagone) partages par
// tout le visuel : cluster de la page d'accueil, mini-jauges des cartes.

import { iconInner } from "./icons.js";

const SIDES = { circle: 0, pentagon: 5, hexagon: 6 };
let gradSeq = 0;

function polygonVertices(cx, cy, r, sides) {
  const start = -Math.PI / 2;
  const step = (2 * Math.PI) / sides;
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = start + i * step;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function shapeEl(shape, cx, cy, r, extraAttrs) {
  const sides = SIDES[shape] ?? 6;
  const attrs = Object.entries(extraAttrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  if (sides === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" transform="rotate(-90 ${cx} ${cy})" ${attrs} />`;
  }
  const pts = polygonVertices(cx, cy, r, sides).map((p) => p.join(",")).join(" ");
  return `<polygon points="${pts}" ${attrs} />`;
}

// Position sur le trace REEL de la forme pour un pourcentage donne (0-100,
// en repartant du sommet, sens horaire) : pour un polygone, suit les
// segments de droite entre sommets (comme le stroke-dasharray avec
// pathLength=100), pas un cercle qui deborderait au milieu des cotes.
function pointOnShape(shape, cx, cy, r, pct) {
  const sides = SIDES[shape] ?? 6;
  const p = ((pct % 100) + 100) % 100;
  if (sides === 0) {
    const angle = -Math.PI / 2 + (p / 100) * 2 * Math.PI;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }
  const verts = polygonVertices(cx, cy, r, sides);
  const t = (p / 100) * sides;
  const seg = Math.floor(t) % sides;
  const frac = t - Math.floor(t);
  const [x1, y1] = verts[seg];
  const [x2, y2] = verts[(seg + 1) % sides];
  return [x1 + (x2 - x1) * frac, y1 + (y2 - y1) * frac];
}

// Degrade le long de l'anneau, du plus terne (debut) au plus vif (le
// pourcentage courant), en suivant le trace reel de la forme.
function progressGradient(defs, cx, cy, r, shape, fromPct, toPct, color, fromOpacity) {
  gradSeq += 1;
  const id = `rgrad${gradSeq}`;
  const [x1, y1] = pointOnShape(shape, cx, cy, r, fromPct);
  const [x2, y2] = pointOnShape(shape, cx, cy, r, toPct);
  defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
    <stop offset="0%" stop-color="${color}" stop-opacity="${fromOpacity ?? 0.3}" />
    <stop offset="100%" stop-color="${color}" stop-opacity="1" />
  </linearGradient>`);
  return `url(#${id})`;
}

// rings: tableau exterieur -> interieur de { pct, color, icon }
// icon (facultatif) : cle de icons.js, dessinee directement au bout de
// l'anneau (sans pastille de fond), comme les fleches de l'app Sante.
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
    const overflowing = rawPct > 100;

    body += shapeEl(shape, cx, cy, r, {
      fill: "none",
      stroke: "var(--track)",
      "stroke-width": strokeW,
      "stroke-linejoin": "round",
    });

    let tipPct = 0;
    if (ring.pct !== null && ring.pct !== undefined) {
      if (overflowing) {
        // Premier tour deja boucle : teinte sourde et unie, pour que le
        // degrade du tour EN COURS (dessine par-dessus) reste le seul
        // repere visible de progression, bien contraste.
        body += shapeEl(shape, cx, cy, r, {
          fill: "none",
          stroke: ring.color,
          "stroke-width": strokeW,
          "stroke-linejoin": "round",
          class: "ring-progress",
          opacity: 0.38,
        });
        const overflowPct = Math.min(100, rawPct - 100);
        const strokeOverflow = progressGradient(defs, cx, cy, r, shape, 0, overflowPct, ring.color, 0.2);
        body += shapeEl(shape, cx, cy, r, {
          fill: "none",
          stroke: strokeOverflow,
          "stroke-width": strokeW,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          pathLength: 100,
          "stroke-dasharray": "0 100",
          "data-fill": `${overflowPct} ${100 - overflowPct}`,
          class: "ring-overflow ring-animate",
        });
        tipPct = overflowPct;
      } else {
        const stroke = progressGradient(defs, cx, cy, r, shape, 0, pct, ring.color, 0.3);
        body += shapeEl(shape, cx, cy, r, {
          fill: "none",
          stroke,
          "stroke-width": strokeW,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          pathLength: 100,
          "stroke-dasharray": "0 100",
          "data-fill": `${pct} ${100 - pct}`,
          class: "ring-progress ring-animate",
        });
        tipPct = pct;
      }
    }

    // Ombre sous le bout de fin (pas au depart) : petit disque au point
    // courant, avec une ombre portee, pour donner du relief a la pointe.
    if (rawPct > 0) {
      const [tx, ty] = pointOnShape(shape, cx, cy, r, tipPct);
      caps.push({ tx, ty, radius: strokeW * 0.42, color: ring.color });
    }

    if (showIcons && ring.icon) {
      const atPct = rawPct > 0 ? tipPct : 0;
      const [tx, ty] = pointOnShape(shape, cx, cy, r, atPct);
      badges.push({ tx, ty, icon: ring.icon });
    }
  });

  caps.forEach(({ tx, ty, radius, color }) => {
    body += `<circle cx="${tx}" cy="${ty}" r="${radius}" fill="${color}" filter="url(#ringShadow)" />`;
  });

  // Icones dessinees directement sur l'anneau (halo blanc + trait sombre),
  // sans pastille de fond, contenues dans la largeur du trait.
  badges.forEach(({ tx, ty, icon }) => {
    const iconSize = strokeW * 0.72;
    const t = `translate(${tx - iconSize / 2} ${ty - iconSize / 2}) scale(${iconSize / 24})`;
    body += `<g transform="${t}" stroke="#fff" fill="none" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.9">${iconInner(icon)}</g>`;
    body += `<g transform="${t}" stroke="#0a0c11" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconInner(icon)}</g>`;
  });

  return `<svg viewBox="0 0 ${size} ${size}" class="ring-cluster" data-shape="${shape}"><defs>${defs.join("")}</defs>${body}</svg>`;
}

// A appeler juste apres avoir insere un ringClusterSVG dans le DOM : lance
// le remplissage anime de zero jusqu'au pourcentage reel (double rAF pour
// laisser le navigateur peindre l'etat a 0 avant de declencher la
// transition CSS vers la valeur cible).
export function animateRings(container) {
  const rings = container.querySelectorAll(".ring-animate");
  if (!rings.length) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      rings.forEach((el) => el.setAttribute("stroke-dasharray", el.dataset.fill));
    });
  });
}
