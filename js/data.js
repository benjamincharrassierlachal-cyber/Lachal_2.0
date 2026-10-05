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

// Le score global n'atteint 100% que si CHAQUE objectif actif est
// entierement rempli (un objectif suivi sans releve cette semaine compte
// comme 0%, pas comme ignore -- le "0" affiche est colore differemment,
// voir fmtValeur dans views.js, pour rester lisible comme "pas de donnee").
//
// Tant qu'un seul objectif manque, un gros depassement ailleurs NE DOIT PAS
// masquer ce manque : chaque indicateur reste plafonne a 100% dans la
// moyenne (comme avant). C'est seulement quand TOUS les objectifs actifs
// sont au moins atteints que le plafond saute, pour laisser un depassement
// general se refleter au-dela de 100%.
function scoreFromPcts(pcts) {
  if (!pcts.length) return null;
  const tousAtteints = pcts.every((p) => p >= 100);
  const somme = pcts.reduce((s, p) => s + (tousAtteints ? p : Math.min(p, 100)), 0);
  return Math.round(somme / pcts.length);
}

function computeHistory(weeks, metrics, objective) {
  return weeks.map((w) => {
    const perMetric = {};
    const pcts = [];
    metrics.forEach((m) => {
      const value = w[m.valueField];
      const obj = objective[m.objectiveField];
      const pct = pctFor(value, obj);
      perMetric[m.key] = { value, objective: obj, pct, status: statusFor(pct) };
      pcts.push(pct === null ? 0 : pct);
    });
    return { ...w, metrics: perMetric, score: scoreFromPcts(pcts) };
  });
}

// Une semaine "a des donnees" si au moins un indicateur actif y a un releve
// (les anciennes lignes mensuelles d'avant septembre n'en ont pas).
export function weekHasData(w, metrics) {
  return metrics.some((m) => {
    const v = w.metrics[m.key]?.value;
    return v !== null && v !== undefined;
  });
}

// "Semaines 37 a 39" (ou "Semaine 37" si une seule). L'annee n'apparait que
// si la periode enjambe deux annees.
export function rangeLabel(from, to) {
  const [yf, nf] = from.split("-S");
  const [yt, nt] = to.split("-S");
  const a = parseInt(nf, 10);
  const b = parseInt(nt, 10);
  if (from === to) return `Semaine ${a}`;
  if (yf === yt) return `Semaines ${a} à ${b}`;
  return `Semaines ${a}/${yf} à ${b}/${yt}`;
}

// Cumule les semaines de [from, to] (bornes incluses, format "AAAA-Sxx") en
// une "semaine" synthetique, utilisable partout a la place d'une semaine
// normale : realise = somme des releves, objectif = objectif hebdo x nombre
// de semaines reellement relevees pour cet indicateur (une semaine sans
// releve ne gonfle pas l'objectif). Renvoie null si aucune ligne dans la
// periode.
export function aggregateRange(history, metrics, objective, from, to) {
  const rows = history.filter((w) => w.semaine >= from && w.semaine <= to);
  if (!rows.length) return null;

  const perMetric = {};
  const pcts = [];
  let dataWeeks = 0;
  metrics.forEach((m) => {
    let sum = 0;
    let n = 0;
    rows.forEach((w) => {
      const v = w.metrics[m.key]?.value;
      if (v !== null && v !== undefined) {
        sum += v;
        n += 1;
      }
    });
    dataWeeks = Math.max(dataWeeks, n);
    const value = n ? sum : null;
    const obj = (objective[m.objectiveField] || 0) * (n || rows.length);
    const pct = pctFor(value, obj);
    perMetric[m.key] = { value, objective: obj, pct, status: statusFor(pct), weeks: n };
    pcts.push(pct === null ? 0 : pct);
  });

  const lastNote = [...rows].reverse().find((w) => w.note !== null && w.note !== undefined);
  const first = rows[0].semaine;
  const last = rows[rows.length - 1].semaine;
  return {
    semaine: first === last ? first : `${first}..${last}`,
    debut: rows[0].debut,
    fin: rows[rows.length - 1].fin,
    note: lastNote ? lastNote.note : null,
    metrics: perMetric,
    score: scoreFromPcts(pcts),
    range: { from: first, to: last, rows: rows.length, dataWeeks, label: rangeLabel(first, last) },
  };
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

// Vue d'ensemble admin : cumule tous les magasins sur une semaine donnee
// (somme des realises / somme des objectifs), plus le detail par magasin
// pour la liste. targetWeek (optionnel) fixe la semaine consultee pour TOUS
// les magasins a la fois (contrairement a la fiche d'un magasin, l'admin
// n'a pas de "semaine courante" propre a chacun) ; par defaut, chaque
// magasin est vu sur sa derniere semaine connue.
//
// `target` peut etre une semaine ("AAAA-Sxx"), une periode {from, to}
// (cumul de toutes les semaines comprises, voir aggregateRange) ou null.
export function buildAdminModel(data, target) {
  const range = target && typeof target === "object" ? target : null;
  const targetWeek = range ? null : target;
  const perStore = data.stores
    .map((s) => buildStoreModel(data, s.code))
    .map((sm) => ({
      ...sm,
      viewWeek: range
        ? aggregateRange(sm.history, sm.metrics, sm.objective, range.from, range.to)
        : targetWeek
          ? sm.history.find((w) => w.semaine === targetWeek) || null
          : sm.currentWeek,
    }))
    .filter((sm) => sm.viewWeek);

  // Un indicateur reste affiche des qu'au moins un magasin le suit,
  // meme si personne n'a encore de releve cette semaine (comme "-/2" sur
  // une fiche magasin) : on ne le fait disparaitre que si aucun magasin
  // du groupe ne le suit du tout.
  const metricsAgg = METRICS.map((m) => {
    let sumValue = 0;
    let sumObjective = 0;
    let tracked = false;
    let hasData = false;
    perStore.forEach((sm) => {
      const pm = sm.viewWeek.metrics[m.key];
      if (!pm) return;
      tracked = true;
      sumObjective += pm.objective || 0;
      if (pm.value !== null && pm.value !== undefined) {
        hasData = true;
        sumValue += pm.value;
      }
    });
    if (!tracked) return null;
    const pct = hasData ? pctFor(sumValue, sumObjective) : null;
    return { ...m, value: hasData ? sumValue : null, objective: sumObjective, pct, status: statusFor(pct) };
  }).filter(Boolean);

  const scored = metricsAgg.filter((x) => x.pct !== null);
  const tousAtteints = scored.length && scored.every((x) => x.pct >= 100);
  const score = scored.length
    ? Math.round(scored.reduce((s, x) => s + (tousAtteints ? x.pct : Math.min(x.pct, 100)), 0) / scored.length)
    : null;

  const weekLabel = range
    ? rangeLabel(range.from, range.to)
    : targetWeek || (perStore.length ? perStore[0].viewWeek.semaine : null);

  return { metricsAgg, score, weekLabel, perStore, isRange: !!range };
}

// Toutes les semaines connues, tous magasins confondus (pour le selecteur
// de semaine de l'admin, qui n'a pas d'historique propre a un seul
// magasin) : la plus recente en premier.
export function allWeeks(data) {
  const semaines = new Set();
  Object.values(data.weeks || {}).forEach((weeks) => weeks.forEach((w) => semaines.add(w.semaine)));
  return [...semaines].sort().reverse();
}

// Semaines ou au moins un magasin a un releve sur un indicateur suivi, de la
// plus ancienne a la plus recente : celles qu'on propose pour une periode.
export function weeksWithDataAdmin(data) {
  const semaines = new Set();
  data.stores.forEach((s) => {
    const sm = buildStoreModel(data, s.code);
    sm.history.forEach((w) => {
      if (weekHasData(w, sm.metrics)) semaines.add(w.semaine);
    });
  });
  return [...semaines].sort();
}

// Total realise depuis le debut et moyenne par semaine, par indicateur
// suivi d'un magasin. La moyenne se fait sur les semaines relevees ET
// terminees (fin < asOf, "AAAA-MM-JJ") : ni une ancienne ligne mensuelle
// sans releve, ni la semaine en cours (encore partielle, souvent a 0 en
// debut de semaine) ne tirent la moyenne vers le bas. S'il n'existe aucune
// semaine terminee, on retombe sur toutes les semaines relevees.
export function buildTotals(history, metrics, asOf) {
  return metrics.map((m) => {
    let total = 0;
    let weeks = 0;
    let sumDone = 0;
    let weeksDone = 0;
    history.forEach((w) => {
      const v = w.metrics[m.key]?.value;
      if (v === null || v === undefined) return;
      total += v;
      weeks += 1;
      if (!asOf || !w.fin || w.fin < asOf) {
        sumDone += v;
        weeksDone += 1;
      }
    });
    return weeksDone
      ? { key: m.key, total, weeks, avg: sumDone / weeksDone, avgWeeks: weeksDone }
      : { key: m.key, total, weeks, avg: weeks ? total / weeks : null, avgWeeks: weeks };
  });
}

// Tendance du groupe entier, semaine par semaine (pour l'onglet Stats de
// l'admin) : pct agrege (somme des realises / somme des objectifs, tous
// magasins qui suivent la metrique cette semaine-la), une courbe par
// indicateur sur tout l'historique disponible.
export function buildAdminTrend(data) {
  const asOf = (data.generated_at || "").slice(0, 10);
  const finSemaine = {};
  const parSemaine = {};
  data.stores.forEach((s) => {
    const objective = data.objectives[s.code] || {};
    const actifs = activeMetrics(objective);
    if (!actifs.length) return;
    (data.weeks[s.code] || []).forEach((w) => {
      if (w.fin && (!finSemaine[w.semaine] || w.fin > finSemaine[w.semaine])) finSemaine[w.semaine] = w.fin;
      const bucket = parSemaine[w.semaine] || (parSemaine[w.semaine] = {});
      actifs.forEach((m) => {
        const value = w[m.valueField];
        if (value === null || value === undefined) return;
        const acc = bucket[m.key] || (bucket[m.key] = { sumValue: 0, sumObjective: 0 });
        acc.sumValue += value;
        acc.sumObjective += objective[m.objectiveField] || 0;
      });
    });
  });

  const semaines = Object.keys(parSemaine).sort();
  const metrics = METRICS.map((m) => {
    const weeks = semaines
      .map((semaine) => {
        const acc = parSemaine[semaine][m.key];
        return acc ? { semaine, pct: pctFor(acc.sumValue, acc.sumObjective) } : null;
      })
      .filter(Boolean);
    if (!weeks.length) return null;
    // total du groupe depuis le debut, et moyenne par semaine (somme de tous
    // les magasins sur une semaine, moyennee sur les semaines relevees)
    let total = 0;
    let weeksCount = 0;
    let sumDone = 0;
    let weeksDone = 0;
    semaines.forEach((semaine) => {
      const acc = parSemaine[semaine][m.key];
      if (!acc) return;
      total += acc.sumValue;
      weeksCount += 1;
      if (!asOf || !finSemaine[semaine] || finSemaine[semaine] < asOf) {
        sumDone += acc.sumValue;
        weeksDone += 1;
      }
    });
    const avgWeeks = weeksDone || weeksCount;
    const avg = weeksDone ? sumDone / weeksDone : weeksCount ? total / weeksCount : null;
    return { ...m, weeks, summary: { total, weeks: weeksCount, avg, avgWeeks } };
  }).filter(Boolean);

  return { metrics };
}
