// Chargement et mise en forme des donnees (data/data.json).
// Ne fait aucun calcul de badge ici : juste des chiffres bruts + pourcentages.

export const METRICS = [
  {
    key: "avis",
    label: "Avis Google",
    short: "Avis",
    unit: "avis",
    icon: "star",
    colorVar: "--c-avis",
    valueField: "avis_nouveaux",
    objectiveField: "avis_semaine",
    showField: "show_avis",
    verbe: "nouveaux avis",
  },
  {
    key: "examens",
    label: "Examens de vue",
    short: "Examens",
    unit: "examens",
    icon: "eye",
    colorVar: "--c-examens",
    valueField: "demandes",
    objectiveField: "examens_semaine",
    showField: "show_examens",
    verbe: "realises cette semaine",
  },
  {
    key: "impressions",
    label: "Impressions 3D",
    short: "Impressions",
    unit: "impr.",
    icon: "cube",
    colorVar: "--c-impr",
    valueField: "impressions",
    objectiveField: "impressions_semaine",
    showField: "show_impressions",
    verbe: "impressions cette semaine",
  },
];

export const ADMIN_CODE = "ADMIN";

let _dataPromise = null;

export function loadData() {
  if (!_dataPromise) {
    _dataPromise = fetch("data/data.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error("data.json introuvable (" + r.status + ")");
        return r.json();
      });
  }
  return _dataPromise;
}

export function activeMetrics(objective) {
  if (!objective) return [];
  return METRICS.filter((m) => objective[m.showField] && (objective[m.objectiveField] || 0) > 0);
}

// pct : null = pas de releve, sinon 0..N (peut depasser 100)
export function pctFor(value, objective) {
  if (value === null || value === undefined) return null;
  if (!objective || objective <= 0) return value > 0 ? 100 : 0;
  return Math.round((value / objective) * 1000) / 10;
}

export function statusFor(pct) {
  if (pct === null) return "none";
  if (pct >= 120) return "gold";
  if (pct >= 100) return "met";
  return "miss";
}

function computeHistory(weeks, metrics, objective) {
  return weeks.map((w) => {
    const perMetric = {};
    let scoreSum = 0;
    let scoreCount = 0;
    metrics.forEach((m) => {
      const value = w[m.valueField];
      const obj = objective[m.objectiveField];
      const pct = pctFor(value, obj);
      perMetric[m.key] = { value, objective: obj, pct, status: statusFor(pct) };
      if (pct !== null) {
        scoreSum += Math.min(pct, 100);
        scoreCount += 1;
      }
    });
    const score = scoreCount ? Math.round(scoreSum / scoreCount) : null;
    return { ...w, metrics: perMetric, score };
  });
}

// Renvoie l'historique enrichi : une entree par semaine, avec par metrique
// active {value, objective, pct, status}.
//
// `history` sert a l'affichage (chiffres reels, jamais tronques) ;
// `trophyHistory` est la version utilisee par les trophees, tronquee a la
// date de depart choisie en admin (data.trophy_start_date) s'il y en a
// une : tout ce qui precede ne compte pour aucun trophee, mais reste
// visible normalement dans les chiffres et l'historique affiches.
export function buildStoreModel(data, code) {
  const store = data.stores.find((s) => s.code === code);
  const objective = data.objectives[code] || {};
  const rawWeeks = data.weeks[code] || [];
  const metrics = activeMetrics(objective);

  const history = computeHistory(rawWeeks, metrics, objective);
  const cutoff = data.trophy_start_date;
  const trophyHistory = cutoff
    ? computeHistory(rawWeeks.filter((w) => w.debut && w.debut >= cutoff), metrics, objective)
    : history;

  return {
    store,
    objective,
    metrics,
    history,
    trophyHistory,
    currentWeek: history.length ? history[history.length - 1] : null,
  };
}

// Vue d'ensemble admin : cumule tous les magasins sur leur semaine
// courante respective (somme des realises / somme des objectifs), plus
// le detail par magasin pour la liste.
export function buildAdminModel(data) {
  const perStore = data.stores
    .map((s) => buildStoreModel(data, s.code))
    .filter((sm) => sm.currentWeek);

  const metricsAgg = METRICS.map((m) => {
    let sumValue = 0;
    let sumObjective = 0;
    let any = false;
    perStore.forEach((sm) => {
      const pm = sm.currentWeek.metrics[m.key];
      if (!pm || pm.value === null || pm.value === undefined) return;
      any = true;
      sumValue += pm.value;
      sumObjective += pm.objective || 0;
    });
    if (!any) return null;
    const pct = pctFor(sumValue, sumObjective);
    return { ...m, value: sumValue, objective: sumObjective, pct, status: statusFor(pct) };
  }).filter(Boolean);

  const scored = metricsAgg.filter((x) => x.pct !== null);
  const score = scored.length
    ? Math.round(scored.reduce((s, x) => s + Math.min(x.pct, 100), 0) / scored.length)
    : null;

  const weekLabel = perStore.length ? perStore[0].currentWeek.semaine : null;

  return { metricsAgg, score, weekLabel, perStore };
}
