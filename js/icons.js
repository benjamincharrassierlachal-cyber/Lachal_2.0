// Petite bibliotheque d'icones ligne (SVG inline, currentColor).

const PATHS = {
  star: "M12 2.8l2.7 5.9 6.4.6-4.9 4.3 1.5 6.3L12 16.9l-5.7 3-1.5-6.3-4.9-4.3 6.4-.6z",
  eye: "M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z|circle:12,12,3",
  cube: "M12 2l9 5v10l-9 5-9-5V7z|M3 7l9 5 9-5|M12 12v10",
  medal: "circle:12,15,6|M9 3h6l1.6 6.8L12 17l-4.6-7.2z",
  crown: "M3 8l4 3 5-6 5 6 4-3-2 11H5z",
  sparkle: "M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4z",
  home: "M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z",
  trophy: "M7 4h10v4a5 5 0 01-5 5 5 5 0 01-5-5zM7 4H3v2a4 4 0 004 4M17 4h4v2a4 4 0 01-4 4M9 21h6M12 13v4",
  gear: "circle:12,12,3|M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  check: "M4 12l5 5L20 6",
  chevronLeft: "M15 4l-8 8 8 8",
  search: "circle:11,11,7|M21 21l-4.3-4.3",
  hexagon: "M12 2l8.7 5v10L12 22l-8.7-5V7z",
  pentagon: "M12 2l9.5 6.9-3.6 11.1H6.1L2.5 8.9z",
  circle: "circle:12,12,9",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  save: "M5 4h11l3 3v13H5z|M8 4v5h7V4|M8 14h8v6H8z",
};

export function icon(name, size = 20, extraClass = "") {
  const spec = PATHS[name] || PATHS.star;
  const parts = spec.split("|").map((seg) => {
    if (seg.startsWith("circle:")) {
      const [cx, cy, r] = seg.slice(7).split(",");
      return `<circle cx="${cx}" cy="${cy}" r="${r}" />`;
    }
    return `<path d="${seg}" />`;
  });
  return `<svg class="icon ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${parts.join("")}</svg>`;
}
