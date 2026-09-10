// Moteur de badges / trophees. Purement fonctionnel : prend le modele d'un
// magasin (voir data.js) et renvoie une liste de badges avec leur etat.

function streaks(seq) {
  let best = 0, running = 0;
  for (const v of seq) {
    if (v === null) continue; // pas de releve : ne casse pas, ne compte pas
    if (v) { running += 1; best = Math.max(best, running); } else running = 0;
  }
  let current = 0;
  for (let i = seq.length - 1; i >= 0; i--) {
    const v = seq[i];
    if (v === null) continue;
    if (v) current += 1; else break;
  }
  return { best, current };
}

const STREAK_TIERS = [
  { n: 3, name: "Bronze" },
  { n: 5, name: "Argent" },
  { n: 10, name: "Or" },
  { n: 20, name: "Platine" },
];

function tierBadge({ id, category, color, icon, name, unlocked, descUnlocked, descLocked, progress }) {
  return { id, category, color, icon, name, unlocked, descUnlocked, descLocked, progress };
}

export function buildBadges(model) {
  const { history, metrics, objective } = model;
  const badges = [];

  // --- Series par metrique ---------------------------------------------
  metrics.forEach((m) => {
    const seq = history.map((w) => {
      const pm = w.metrics[m.key];
      if (!pm || pm.status === "none") return null;
      return pm.status === "met" || pm.status === "gold";
    });
    const { best } = streaks(seq);
    STREAK_TIERS.forEach((t) => {
      badges.push(tierBadge({
        id: `serie_${m.key}_${t.n}`,
        category: "Series",
        color: `var(${m.colorVar})`,
        icon: m.icon,
        name: `${t.name} — ${m.short}`,
        unlocked: best >= t.n,
        descUnlocked: `Objectif "${m.label}" tenu ${best} semaines d'affilee (record du magasin).`,
        descLocked: `Tenir l'objectif "${m.label}" pendant ${t.n} semaines consecutives.`,
        progress: `${Math.min(best, t.n)}/${t.n}`,
      }));
    });

    const values = history
      .map((w) => ({ v: w.metrics[m.key]?.value, s: w.semaine }))
      .filter((x) => x.v !== null && x.v !== undefined);
    if (values.length) {
      const top = values.reduce((a, b) => (b.v > a.v ? b : a));
      badges.push(tierBadge({
        id: `record_${m.key}`,
        category: "Records",
        color: `var(${m.colorVar})`,
        icon: m.icon,
        name: `Record — ${m.short}`,
        unlocked: true,
        descUnlocked: `${top.v} en une semaine (${top.s}).`,
        descLocked: `Realisez au moins un releve de "${m.label}" pour ouvrir ce record.`,
        progress: null,
      }));
    }
  });

  // --- Semaine parfaite / grand chelem -----------------------------------
  if (metrics.length) {
    const perfect = history.filter((w) =>
      metrics.every((m) => ["met", "gold"].includes(w.metrics[m.key]?.status))
    ).length;
    [1, 5, 15].forEach((t) => {
      badges.push(tierBadge({
        id: `parfaite_${t}`,
        category: "Combo",
        color: "var(--gold)",
        icon: "medal",
        name: t === 1 ? "Semaine parfaite" : `${t} semaines parfaites`,
        unlocked: perfect >= t,
        descUnlocked: `${perfect} semaine(s) avec tous les objectifs actifs atteints.`,
        descLocked: `Atteindre tous les objectifs actifs la meme semaine, ${t} fois.`,
        progress: `${Math.min(perfect, t)}/${t}`,
      }));
    });

    const chelem = history.filter((w) =>
      metrics.every((m) => w.metrics[m.key]?.status === "gold")
    ).length;
    [1, 3, 10].forEach((t) => {
      badges.push(tierBadge({
        id: `chelem_${t}`,
        category: "Combo",
        color: "var(--gold)",
        icon: "crown",
        name: t === 1 ? "Grand chelem" : `${t}x Grand chelem`,
        unlocked: chelem >= t,
        descUnlocked: `${chelem} semaine(s) avec tous les objectifs depasses de 20% ou plus.`,
        descLocked: `Depasser tous les objectifs actifs de 20% ou plus, la meme semaine, ${t} fois.`,
        progress: `${Math.min(chelem, t)}/${t}`,
      }));
    });
  }

  // --- Paliers cumules : avis Google --------------------------------------
  if (metrics.some((m) => m.key === "avis")) {
    const cumules = history.map((w) => w.avis_cumules).filter((v) => v !== null && v !== undefined);
    const max = cumules.length ? Math.max(...cumules) : 0;
    [50, 100, 250, 500, 1000, 2000].forEach((t) => {
      badges.push(tierBadge({
        id: `palier_avis_${t}`,
        category: "Paliers",
        color: "var(--c-avis)",
        icon: "star",
        name: `${t} avis Google`,
        unlocked: max >= t,
        descUnlocked: `${max} avis cumules sur Google.`,
        descLocked: `Atteindre ${t} avis Google cumules.`,
        progress: `${Math.min(max, t)}/${t}`,
      }));
    });
  }

  // --- Etoile Google : note tenue -----------------------------------------
  if (objective.note_cible) {
    const seq = history.map((w) =>
      w.note === null || w.note === undefined ? null : w.note >= objective.note_cible
    );
    const { best } = streaks(seq);
    [4, 8, 12].forEach((t) => {
      badges.push(tierBadge({
        id: `etoile_${t}`,
        category: "Series",
        color: "var(--c-avis)",
        icon: "sparkle",
        name: `Etoile fidele x${t}`,
        unlocked: best >= t,
        descUnlocked: `Note Google >= ${objective.note_cible} maintenue ${best} semaines d'affilee.`,
        descLocked: `Maintenir la note Google >= ${objective.note_cible} pendant ${t} semaines.`,
        progress: `${Math.min(best, t)}/${t}`,
      }));
    });
  }

  // --- Cumuls examens / impressions ---------------------------------------
  const cumulTotal = (field) => history.reduce((s, w) => s + (w[field] || 0), 0);
  if (metrics.some((m) => m.key === "examens")) {
    const total = cumulTotal("demandes");
    [20, 50, 100, 200].forEach((t) => {
      badges.push(tierBadge({
        id: `cumul_examens_${t}`,
        category: "Paliers",
        color: "var(--c-examens)",
        icon: "eye",
        name: `${t} examens realises`,
        unlocked: total >= t,
        descUnlocked: `${total} examens de vue realises au total.`,
        descLocked: `Atteindre ${t} examens de vue realises au total.`,
        progress: `${Math.min(total, t)}/${t}`,
      }));
    });
  }
  if (metrics.some((m) => m.key === "impressions")) {
    const total = cumulTotal("impressions");
    [50, 150, 300, 600].forEach((t) => {
      badges.push(tierBadge({
        id: `cumul_impr_${t}`,
        category: "Paliers",
        color: "var(--c-impr)",
        icon: "cube",
        name: `${t} impressions 3D`,
        unlocked: total >= t,
        descUnlocked: `${total} impressions 3D realisees au total.`,
        descLocked: `Atteindre ${t} impressions 3D realisees au total.`,
        progress: `${Math.min(total, t)}/${t}`,
      }));
    });
  }

  return badges;
}

export function bestCurrentStreaks(model) {
  const out = {};
  model.metrics.forEach((m) => {
    const seq = model.history.map((w) => {
      const pm = w.metrics[m.key];
      if (!pm || pm.status === "none") return null;
      return pm.status === "met" || pm.status === "gold";
    });
    out[m.key] = streaks(seq);
  });
  return out;
}
