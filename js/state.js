// Preferences locales (par appareil / navigateur) : magasin choisi, forme,
// theme de couleurs. Rien de tout ca ne quitte l'appareil.

const KEY = "suiviTrophees.v1";

const DEFAULTS = {
  storeCode: null,
  shape: "hexagon", // circle | pentagon | hexagon
  theme: "aurora", // aurora | sunset | neon
  // Assiduite de consultation, suivie en silence (pas affichee) pour de
  // futurs trophees : jours distincts, serie en cours, meilleure serie.
  visits: { totalDays: 0, currentStreak: 0, bestStreak: 0, lastVisitDate: null, firstVisitDate: null },
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

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A appeler une fois par ouverture de l'appli. Compte les jours distincts de
// consultation et la meilleure serie de jours consecutifs, sans rien
// afficher : sert de base a de futurs trophees d'assiduite.
export function recordVisit() {
  const today = todayISO();
  const v = settings.visits || { ...DEFAULTS.visits };
  if (v.lastVisitDate === today) return; // deja compte aujourd'hui

  const yesterday = new Date(Date.now() - 86400000);
  const yISO = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  v.totalDays += 1;
  v.currentStreak = v.lastVisitDate === yISO ? v.currentStreak + 1 : 1;
  v.bestStreak = Math.max(v.bestStreak, v.currentStreak);
  v.firstVisitDate = v.firstVisitDate || today;
  v.lastVisitDate = today;

  setSetting("visits", v);
}
