// Generation des anneaux SVG (cercle, pentagone, hexagone) partages par
// tout le visuel : cluster de la page d'accueil, mini-jauges des cartes,
// icones de trophee.

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

// rings: tableau exterieur -> interieur de { pct, color, track }
// Renvoie une chaine SVG complete, carree, viewBox 0 0 size size.
export function ringClusterSVG(size, rings, shape) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 6;
  const gap = maxR / (rings.length + 0.6);
  const strokeW = Math.max(6, gap * 0.62);

  let out = `<svg viewBox="0 0 ${size} ${size}" class="ring-cluster" data-shape="${shape}">`;
  rings.forEach((ring, i) => {
    const r = maxR - i * gap;
    const pct = Math.max(0, Math.min(100, ring.pct ?? 0));
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
        "pathLength": 100,
        "stroke-dasharray": `${pct} ${100 - pct}`,
        class: "ring-progress",
      });
    }
    if ((ring.pct ?? 0) > 100) {
      // petit repere de depassement : un pointeur au sommet
      out += shapeEl(shape, cx, cy, r, {
        fill: "none",
        stroke: ring.color,
        "stroke-width": strokeW * 0.5,
        opacity: 0.55,
        "pathLength": 100,
        "stroke-dasharray": `${Math.min(100, (ring.pct ?? 0) - 100)} ${100}`,
        class: "ring-overflow",
      });
    }
  });
  out += "</svg>";
  return out;
}

export function miniRingSVG(pct, color, shape, size) {
  size = size || 40;
  return ringClusterSVG(size, [{ pct, color }], shape).replace(
    'class="ring-cluster"',
    'class="ring-cluster ring-cluster--mini"'
  );
}

export function badgeShapeSVG(shape, color, locked, size) {
  size = size || 56;
  const cx = size / 2, cy = size / 2, r = size / 2 - 3;
  const fill = locked ? "var(--locked-fill)" : color;
  const stroke = locked ? "var(--locked-stroke)" : color;
  return `<svg viewBox="0 0 ${size} ${size}" class="badge-shape">${shapeEl(shape, cx, cy, r, {
    fill,
    stroke,
    "stroke-width": 2,
    opacity: locked ? 0.55 : 1,
  })}</svg>`;
}
