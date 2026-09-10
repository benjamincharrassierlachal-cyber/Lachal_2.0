// Moteur de badges / trophees. Purement fonctionnel : prend le modele d'un
// magasin (voir data.js) et l'assiduite de l'appareil (voir state.js), et
// renvoie une liste de badges avec leur etat.

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

function badge({ id, category, color, icon, name, unlocked, descUnlocked, descLocked, progress }) {
  return { id, category, color, icon, name, unlocked, descUnlocked, descLocked, progress: progress ?? null };
}

const STREAK_TIERS = [
  { n: 3, name: "Bronze" },
  { n: 5, name: "Argent" },
  { n: 10, name: "Or" },
  { n: 20, name: "Platine" },
];

// Seuils "record" par indicateur : la meilleure semaine jamais atteinte,
// exprimee en % de l'objectif hebdomadaire.
const RECORD_TIERS = [
  { pct: 210, label: "+110%" },
  { pct: 250, label: "+150%" },
  { pct: 300, label: "+200%" },
];

// Seuils "atteint au moins une fois", specifiques a chaque indicateur.
const SEUIL_TIERS = {
  avis: [[120, "Aimant à avis"], [150, "Pluie d'étoiles"]],
  examens: [[100, "Œil de lynx"], [125, "Visionnaire"], [150, "Maître de la vision"]],
  impressions: [[100, "Première couche"], [125, "Fab Lab"], [150, "Industrie 4.0"]],
};

// Semaines "tous objectifs actifs atteints", en serie CONSECUTIVE (fusion de
// l'ancienne "semaine parfaite" avec Doublé/Triplé/Marathonien/Inarrêtable).
const PARFAITE_TIERS = [
  { n: 1, name: "Sans faute" },
  { n: 2, name: "Doublé" },
  { n: 3, name: "Triplé" },
  { n: 5, name: "Marathonien" },
  { n: 10, name: "Inarrêtable" },
  { n: 15, name: "15 semaines parfaites" },
];

const CHELEM_TIERS = [
  { n: 1, name: "Grand Chelem" },
  { n: 3, name: "3x Grand Chelem" },
  { n: 10, name: "10x Grand Chelem" },
];

const SCORE_TIERS = [
  { pct: 80, name: "Semaine Bronze" },
  { pct: 100, name: "Semaine Argent" },
  { pct: 120, name: "Semaine Or" },
  { pct: 150, name: "Semaine Diamant" },
];

const EXPLOIT_TIERS = [
  { pct: 110, name: "Décollage" },
  { pct: 125, name: "Ça chauffe !" },
  { pct: 150, name: "Survolté" },
  { pct: 200, name: "Hors normes" },
];

const ASSIDUITE_SEMAINES = [
  { n: 3, name: "Habitué" },
  { n: 7, name: "Fidèle" },
  { n: 21, name: "Assidu" },
  { n: 52, name: "Indécrochable" },
];

const COLLECTION_TIERS = [
  { n: 5, name: "Collectionneur" },
  { n: 10, name: "Chasseur de trophées" },
  { n: 15, name: "Expert" },
  { n: 20, name: "Maître des trophées" },
  { n: 25, name: "Grand Collectionneur" },
  { n: 30, name: "PLATINIUM" },
];

export function buildBadges(model, visits) {
  const { history, metrics, objective } = model;
  const badges = [];

  const pctSeq = (key) => history.map((w) => w.metrics[key]?.pct ?? null);
  const maxOf = (arr) => (arr.length ? Math.max(...arr) : null);

  // --- Series par metrique (objectif tenu N semaines consecutives) -------
  metrics.forEach((m) => {
    const seq = history.map((w) => {
      const pm = w.metrics[m.key];
      if (!pm || pm.status === "none") return null;
      return pm.status === "met" || pm.status === "gold";
    });
    const { best } = streaks(seq);
    STREAK_TIERS.forEach((t) => {
      badges.push(badge({
        id: `serie_${m.key}_${t.n}`,
        category: "Series",
        color: `var(${m.colorVar})`,
        icon: m.icon,
        name: `${t.name} — ${m.short}`,
        unlocked: best >= t.n,
        descUnlocked: `Objectif "${m.label}" tenu ${best} semaines d'affilée (record du magasin).`,
        descLocked: `Tenir l'objectif "${m.label}" pendant ${t.n} semaines consécutives.`,
        progress: `${Math.min(best, t.n)}/${t.n}`,
      }));
    });

    // --- Records par indicateur (peut se debloquer plusieurs fois : un
    // palier different par metrique) ---
    const values = pctSeq(m.key).filter((p) => p !== null);
    const max = maxOf(values);
    RECORD_TIERS.forEach((t) => {
      badges.push(badge({
        id: `record_${m.key}_${t.pct}`,
        category: "Records",
        color: `var(${m.colorVar})`,
        icon: m.icon,
        name: `Record ${m.short} ${t.label}`,
        unlocked: max !== null && max >= t.pct,
        descUnlocked: `Meilleure semaine ${m.label.toLowerCase()} : ${max}% de l'objectif.`,
        descLocked: `Atteindre ${t.pct}% de l'objectif ${m.label.toLowerCase()} en une semaine.`,
        progress: `${max === null ? 0 : Math.min(max, t.pct)}%/${t.pct}%`,
      }));
    });

    // --- Seuils ponctuels par indicateur ---
    (SEUIL_TIERS[m.key] || []).forEach(([pct, name]) => {
      const reached = values.some((v) => v >= pct);
      badges.push(badge({
        id: `seuil_${m.key}_${pct}`,
        category: "Seuils",
        color: `var(${m.colorVar})`,
        icon: m.icon,
        name,
        unlocked: reached,
        descUnlocked: `${pct}% de l'objectif ${m.label.toLowerCase()} atteint sur une semaine.`,
        descLocked: `Atteindre ${pct}% de l'objectif ${m.label.toLowerCase()} sur une semaine.`,
      }));
    });
  });

  // --- Notes Google --------------------------------------------------------
  const noteSeq = history.map((w) => (w.note === undefined ? null : w.note));
  if (noteSeq.some((n) => n !== null)) {
    const reached5 = noteSeq.some((n) => n !== null && n >= 5);
    badges.push(badge({
      id: "note_5",
      category: "Notes",
      color: "var(--c-avis)",
      icon: "star",
      name: "Cinq étoiles",
      unlocked: reached5,
      descUnlocked: "Note Google de 5,0 atteinte.",
      descLocked: "Atteindre une note Google de 5,0.",
    }));

    const seq48 = noteSeq.map((n) => (n === null ? null : n >= 4.8));
    const s48 = streaks(seq48);
    [[4, "Excellence"], [12, "Excellence durable"]].forEach(([n, name]) => {
      badges.push(badge({
        id: `note_48_${n}`,
        category: "Notes",
        color: "var(--c-avis)",
        icon: "sparkle",
        name,
        unlocked: s48.best >= n,
        descUnlocked: `Note Google ≥ 4,8 maintenue ${s48.best} semaines d'affilée.`,
        descLocked: `Maintenir la note Google ≥ 4,8 pendant ${n} semaines.`,
        progress: `${Math.min(s48.best, n)}/${n}`,
      }));
    });

    const seq5 = noteSeq.map((n) => (n === null ? null : n >= 5));
    const s5 = streaks(seq5);
    badges.push(badge({
      id: "note_5_4",
      category: "Notes",
      color: "var(--c-avis)",
      icon: "sparkle",
      name: "Réputation parfaite",
      unlocked: s5.best >= 4,
      descUnlocked: `Note Google de 5,0 maintenue ${s5.best} semaines d'affilée.`,
      descLocked: "Maintenir la note Google de 5,0 pendant 4 semaines.",
      progress: `${Math.min(s5.best, 4)}/4`,
    }));
  }

  // --- Exploits ponctuels, tous indicateurs confondus ---------------------
  if (metrics.length) {
    const anyPcts = history.flatMap((w) => metrics.map((m) => w.metrics[m.key]?.pct).filter((p) => p !== null && p !== undefined));
    const anyMax = maxOf(anyPcts);
    const exact100 = history.some((w) => metrics.some((m) => w.metrics[m.key]?.pct === 100));

    badges.push(badge({
      id: "premier_pas",
      category: "Exploits",
      color: "var(--gold)",
      icon: "rocket",
      name: "Premier pas",
      unlocked: anyMax !== null && anyMax >= 100,
      descUnlocked: "100% d'un objectif atteint, pour la première fois.",
      descLocked: "Atteindre 100% d'un objectif, tous indicateurs confondus.",
    }));
    badges.push(badge({
      id: "dans_le_mille",
      category: "Exploits",
      color: "var(--gold)",
      icon: "target",
      name: "Dans le mille",
      unlocked: exact100,
      descUnlocked: "Un objectif hebdomadaire atteint à exactement 100%.",
      descLocked: "Atteindre exactement 100% d'un objectif hebdomadaire.",
    }));
    EXPLOIT_TIERS.forEach((t) => {
      badges.push(badge({
        id: `exploit_${t.pct}`,
        category: "Exploits",
        color: "var(--gold)",
        icon: "rocket",
        name: t.name,
        unlocked: anyMax !== null && anyMax >= t.pct,
        descUnlocked: `${t.pct}% d'un objectif atteint, tous indicateurs confondus.`,
        descLocked: `Atteindre ${t.pct}% d'un objectif, tous indicateurs confondus.`,
      }));
    });
  }

  // --- Semaines "tous objectifs actifs" (serie consecutive) ---------------
  if (metrics.length) {
    const perfectSeq = history.map((w) => {
      const statuses = metrics.map((m) => w.metrics[m.key]?.status);
      if (statuses.some((s) => s === "none")) return null;
      return statuses.every((s) => s === "met" || s === "gold");
    });
    const p = streaks(perfectSeq);
    PARFAITE_TIERS.forEach((t) => {
      badges.push(badge({
        id: `parfaite_${t.n}`,
        category: "Combo",
        color: "var(--gold)",
        icon: "medal",
        name: t.name,
        unlocked: p.best >= t.n,
        descUnlocked: `${p.best} semaine(s) d'affilée avec tous les objectifs actifs atteints.`,
        descLocked: `Atteindre tous les objectifs actifs la même semaine, ${t.n} semaine(s) d'affilée.`,
        progress: `${Math.min(p.best, t.n)}/${t.n}`,
      }));
    });

    const chelemCount = history.filter((w) => {
      const statuses = metrics.map((m) => w.metrics[m.key]?.status);
      if (statuses.some((s) => s === "none")) return false;
      return statuses.every((s) => s === "gold");
    }).length;
    CHELEM_TIERS.forEach((t) => {
      badges.push(badge({
        id: `chelem_${t.n}`,
        category: "Combo",
        color: "var(--gold)",
        icon: "crown",
        name: t.name,
        unlocked: chelemCount >= t.n,
        descUnlocked: `${chelemCount} semaine(s) avec tous les objectifs actifs dépassés de 20% ou plus.`,
        descLocked: `Dépasser tous les objectifs actifs de 20% ou plus, la même semaine, ${t.n} fois.`,
        progress: `${Math.min(chelemCount, t.n)}/${t.n}`,
      }));
    });
  }

  // --- Score hebdomadaire global -------------------------------------------
  const scores = history.map((w) => w.score).filter((s) => s !== null && s !== undefined);
  const maxScore = maxOf(scores);
  SCORE_TIERS.forEach((t) => {
    badges.push(badge({
      id: `score_${t.pct}`,
      category: "Semaine",
      color: "var(--gold)",
      icon: "medal",
      name: t.name,
      unlocked: maxScore !== null && maxScore >= t.pct,
      descUnlocked: `Score hebdomadaire d'au moins ${t.pct}% atteint (record : ${maxScore}%).`,
      descLocked: `Terminer une semaine avec un score global d'au moins ${t.pct}%.`,
    }));
  });

  if (metrics.length) {
    const greenSeq = history.map((w) => {
      const pcts = metrics.map((m) => w.metrics[m.key]?.pct);
      if (pcts.some((p) => p === null || p === undefined)) return null;
      return pcts.every((p) => p >= 80);
    });
    const g = streaks(greenSeq);
    badges.push(badge({
      id: "toujours_vert",
      category: "Semaine",
      color: "var(--c-impr)",
      icon: "shield",
      name: "Toujours dans le vert",
      unlocked: g.best >= 4,
      descUnlocked: `${g.best} semaines sans repasser sous 80% sur un objectif actif.`,
      descLocked: "Rester au-dessus de 80% sur tous les objectifs actifs pendant 4 semaines.",
      progress: `${Math.min(g.best, 4)}/4`,
    }));
  }

  {
    let remontada = false;
    for (let i = 0; i < history.length - 1; i++) {
      const a = history[i].score, b = history[i + 1].score;
      if (a !== null && a !== undefined && b !== null && b !== undefined && a < 80 && b > 120) { remontada = true; break; }
    }
    badges.push(badge({
      id: "remontada",
      category: "Semaine",
      color: "var(--c-examens)",
      icon: "trending",
      name: "Remontada",
      unlocked: remontada,
      descUnlocked: "Passage d'une semaine sous 80% à une semaine au-dessus de 120%.",
      descLocked: "Passer d'une semaine sous 80% à une semaine au-dessus de 120% (score global).",
    }));
  }

  // --- Paliers cumules -------------------------------------------------------
  if (metrics.some((m) => m.key === "avis")) {
    const cumules = history.map((w) => w.avis_cumules).filter((v) => v !== null && v !== undefined);
    const max = cumules.length ? Math.max(...cumules) : 0;
    [50, 100, 250, 500, 1000, 2000].forEach((t) => {
      badges.push(badge({
        id: `palier_avis_${t}`,
        category: "Paliers",
        color: "var(--c-avis)",
        icon: "star",
        name: `${t} avis Google`,
        unlocked: max >= t,
        descUnlocked: `${max} avis cumulés sur Google.`,
        descLocked: `Atteindre ${t} avis Google cumulés.`,
        progress: `${Math.min(max, t)}/${t}`,
      }));
    });
  }

  const cumulTotal = (field) => history.reduce((s, w) => s + (w[field] || 0), 0);
  if (metrics.some((m) => m.key === "examens")) {
    const total = cumulTotal("demandes");
    [20, 50, 100, 200].forEach((t) => {
      badges.push(badge({
        id: `cumul_examens_${t}`,
        category: "Paliers",
        color: "var(--c-examens)",
        icon: "eye",
        name: `${t} examens réalisés`,
        unlocked: total >= t,
        descUnlocked: `${total} examens de vue réalisés au total.`,
        descLocked: `Atteindre ${t} examens de vue réalisés au total.`,
        progress: `${Math.min(total, t)}/${t}`,
      }));
    });
  }
  if (metrics.some((m) => m.key === "impressions")) {
    const total = cumulTotal("impressions");
    [50, 150, 300, 600].forEach((t) => {
      badges.push(badge({
        id: `cumul_impr_${t}`,
        category: "Paliers",
        color: "var(--c-impr)",
        icon: "cube",
        name: `${t} impressions 3D`,
        unlocked: total >= t,
        descUnlocked: `${total} impressions 3D réalisées au total.`,
        descLocked: `Atteindre ${t} impressions 3D réalisées au total.`,
        progress: `${Math.min(total, t)}/${t}`,
      }));
    });
  }

  // --- Assiduite (appareil, pas le magasin) --------------------------------
  if (visits) {
    badges.push(badge({
      id: "assid_3j",
      category: "Assiduite",
      color: "var(--c-avis)",
      icon: "flame",
      name: "Premier rendez-vous",
      unlocked: visits.totalDays >= 3,
      descUnlocked: `${visits.totalDays} jours différents où l'appli a été consultée.`,
      descLocked: "Ouvrir l'appli 3 jours différents.",
      progress: `${Math.min(visits.totalDays, 3)}/3`,
    }));
    ASSIDUITE_SEMAINES.forEach((t) => {
      const best = visits.bestWeekStreak || 0;
      badges.push(badge({
        id: `assid_sem_${t.n}`,
        category: "Assiduite",
        color: "var(--c-avis)",
        icon: "flame",
        name: t.name,
        unlocked: best >= t.n,
        descUnlocked: `${best} semaines consécutives de consultation.`,
        descLocked: `Consulter l'appli au moins ${t.n} semaines consécutives.`,
        progress: `${Math.min(best, t.n)}/${t.n}`,
      }));
    });
    const totalWeeks = visits.totalWeeks || 0;
    badges.push(badge({
      id: "assid_20sem",
      category: "Assiduite",
      color: "var(--c-avis)",
      icon: "calendar",
      name: "Toujours là",
      unlocked: totalWeeks >= 20,
      descUnlocked: `${totalWeeks} semaines différentes de consultation au total.`,
      descLocked: "Consulter l'appli pendant 20 semaines différentes (pas forcément d'affilée).",
      progress: `${Math.min(totalWeeks, 20)}/20`,
    }));
  }

  // --- Collection de trophees (meta) ---------------------------------------
  const baseUnlocked = badges.filter((b) => b.unlocked).length;
  COLLECTION_TIERS.forEach((t) => {
    badges.push(badge({
      id: `collection_${t.n}`,
      category: "Collection",
      color: "var(--gold)",
      icon: "chest",
      name: t.name,
      unlocked: baseUnlocked >= t.n,
      descUnlocked: `${baseUnlocked} trophées débloqués.`,
      descLocked: `Débloquer ${t.n} trophées.`,
      progress: `${Math.min(baseUnlocked, t.n)}/${t.n}`,
    }));
  });

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
