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

// Renvoie l'historique enrichi : une entree par semaine, avec par metrique
// active {value, objective, pct, status}.
export function buildStoreModel(data, code) {
  const store = data.stores.find((s) => s.code === code);
  const objective = data.objectives[code] || {};
  const rawWeeks = data.weeks[code] || [];
  const metrics = activeMetrics(objective);

  const history = rawWeeks.map((w) => {
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

  return {
    store,
    objective,
    metrics,
    history,
    currentWeek: history.length ? history[history.length - 1] : null,
  };
}
