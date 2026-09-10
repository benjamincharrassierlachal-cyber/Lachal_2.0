// Preferences locales (par appareil / navigateur) : magasin choisi, forme,
// theme de couleurs. Rien de tout ca ne quitte l'appareil.

const KEY = "suiviTrophees.v1";

const DEFAULTS = {
  storeCode: null,
  shape: "hexagon", // circle | pentagon | hexagon
  theme: "aurora", // aurora | sunset | neon
  // Assiduite de consultation, suivie en silence (pas affichee) pour les
  // trophees "Assiduite" : jours distincts, et semaines distinctes /
  // consecutives (l'appli n'est mise a jour qu'une fois par semaine, donc
  // c'est la cadence hebdomadaire qui compte le plus).
  visits: {
    totalDays: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastVisitDate: null,
    firstVisitDate: null,
    totalWeeks: 0,
    currentWeekStreak: 0,
    bestWeekStreak: 0,
    lastVisitWeek: null,
  },
  // Trophees deja "recuperes" a l'ecran de recompense, par magasin
  // (code -> liste d'ids de badges). Un badge debloque mais absent de
  // cette liste declenche l'ecran de recompense a l'ouverture.
  claimed: {},
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULTS, ...saved, visits: { ...DEFAULTS.visits, ...(saved.visits || {}) } };
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

function dateISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Semaine ISO (annee-Sxx), meme convention que les donnees compilees.
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi = 0 ... dimanche = 6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de cette semaine
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((date - firstThursday) / (7 * 86400000));
  return `${date.getUTCFullYear()}-S${String(week).padStart(2, "0")}`;
}

// A appeler une fois par ouverture de l'appli. Compte les jours et semaines
// distincts de consultation, et les meilleures series, sans rien afficher :
// sert de base aux trophees d'assiduite.
export function recordVisit() {
  const now = new Date();
  const today = dateISO(now);
  const v = settings.visits || { ...DEFAULTS.visits };
  if (v.lastVisitDate === today) return; // deja compte aujourd'hui

  const yesterday = new Date(now.getTime() - 86400000);
  v.totalDays += 1;
  v.currentStreak = v.lastVisitDate === dateISO(yesterday) ? v.currentStreak + 1 : 1;
  v.bestStreak = Math.max(v.bestStreak, v.currentStreak);
  v.firstVisitDate = v.firstVisitDate || today;
  v.lastVisitDate = today;

  const thisWeek = isoWeekKey(now);
  if (v.lastVisitWeek !== thisWeek) {
    const prevWeek = isoWeekKey(new Date(now.getTime() - 7 * 86400000));
    v.totalWeeks += 1;
    v.currentWeekStreak = v.lastVisitWeek === prevWeek ? v.currentWeekStreak + 1 : 1;
    v.bestWeekStreak = Math.max(v.bestWeekStreak, v.currentWeekStreak);
    v.lastVisitWeek = thisWeek;
  }

  setSetting("visits", v);
}

export function claimedBadges(storeCode) {
  return settings.claimed[storeCode] || [];
}

export function claimBadge(storeCode, badgeId) {
  const list = claimedBadges(storeCode);
  if (list.includes(badgeId)) return;
  setSetting("claimed", { ...settings.claimed, [storeCode]: [...list, badgeId] });
}
