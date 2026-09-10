// Preferences locales (par appareil / navigateur) : magasin choisi, forme,
// theme de couleurs. Rien de tout ca ne quitte l'appareil.

const KEY = "suiviTrophees.v1";

const DEFAULTS = {
  storeCode: null,
  shape: "hexagon", // circle | pentagon | hexagon
  theme: "aurora", // aurora | sunset | neon
};

function read() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* stockage indisponible (navigation privee) : tant pis, session seule */
  }
}

export const settings = read();

export function setSetting(key, value) {
  settings[key] = value;
  write(settings);
}
