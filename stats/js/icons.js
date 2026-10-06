// Icones propres a l'appli Stats, en complement de ../../js/icons.js (que l'on
// reutilise tel quel pour les icones deja existantes).

import { iconInner as baseInner } from "../../js/icons.js";

const EXTRA = {
  pulse: "M3 12h4l2-6 4 12 2-6h6",
  sun: "circle:12,12,4|M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8",
  users: "circle:9,8,3.2|M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6|circle:17,9,2.6|M16 14.2c3 0 5 2 5 5",
  store: "M4 9l1.5-5h13L20 9|M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0|M5 12v8h14v-8|M10 20v-5h4v5",
  bars: "M4 20h16|M7 20v-7|M12 20V5|M17 20v-10",
  list: "M8 6h12|M8 12h12|M8 18h12|circle:4,6,1|circle:4,12,1|circle:4,18,1",
  arrowUp: "M12 19V5|M6 11l6-6 6 6",
  arrowDown: "M12 5v14|M6 13l6 6 6-6",
  info: "circle:12,12,9|M12 11v6|circle:12,7.6,.6",
  lock: "M6 11h12v9H6z|M8 11V8a4 4 0 018 0v3",
  logout: "M9 4H5v16h4|M16 8l4 4-4 4|M20 12H9",
  eyeOff: "M3 3l18 18|M10.6 6.2A9.6 9.6 0 0112 6c7 0 10.5 6 10.5 6a17 17 0 01-3.2 3.9|M6.5 7.6C3.6 9.5 1.5 12 1.5 12S5 18 12 18c1.6 0 3-.3 4.3-.9",
};

function build(spec) {
  return spec
    .split("|")
    .map((seg) => {
      if (seg.startsWith("circle:")) {
        const [cx, cy, r] = seg.slice(7).split(",");
        return `<circle cx="${cx}" cy="${cy}" r="${r}" />`;
      }
      return `<path d="${seg}" />`;
    })
    .join("");
}

export function iconInner(name) {
  return EXTRA[name] ? build(EXTRA[name]) : baseInner(name);
}

export function icon(name, size = 20, extraClass = "") {
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconInner(name)}</svg>`;
}
