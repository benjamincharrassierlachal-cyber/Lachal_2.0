// Page "Chiffres" : tous les indicateurs, mais en graphiques plutot qu'en
// liste. Chaque famille a sa mise en forme (jauges, donuts, barres N-1 / N,
// colonnes, podium du mix...). Tout indicateur non traite par une mise en
// forme dediee retombe sur une ligne generique pour que rien ne manque.

import { CAT, fmtValue, compareRef, estComparable, valeurN1, esc, num0, fmtDateFr } from "./catalog.js";
import { icon } from "./icons.js";
import { positionDansDist } from "./model.js";
import { arcGauge, donut, stackedBar, pairBars, bullet, columns, chipEvol, animerGraphiques } from "./charts.js";

const COULEUR_AUTRE = "var(--text-faint)";

// Donnees d'un indicateur pour l'entite affichee.
function kv(ctx, key) {
  const k = CAT.byKey[key];
  if (!k) return null;
  const i = ctx.ix[key];
  const v = ctx.ent.v ? ctx.ent.v[i] : null;
  if (v === null || v === undefined) return null;
  const e = ctx.ent.e ? ctx.ent.e[i] : null;
  const r = ctx.ref ? ctx.ref.v[i] : null;
  return {
    k, v, e, r: r === undefined ? null : r, prev: valeurN1(k, v, e),
    dist: ctx.dist && ctx.level === "store" ? ctx.dist[key] : null,
  };
}

function chipRef(ctx, d) {
  const c = ctx.ref ? compareRef(d.k, d.v, d.r, ctx.partDe) : null;
  return c ? `<span class="st-chip st-chip--${c.tone}">${c.txt}${c.ref ? " <em>réf.</em>" : ""}</span>` : "";
}

// Echelle d'une jauge en arc : jusqu'au maxi du reseau si on le connait, sinon
// un peu au-dessus de la plus grande des valeurs affichees.
function echelleArc(d) {
  const plafond = d.k.fmt === "pct" ? 1 : Infinity;
  const base = d.dist ? d.dist[d.dist.length - 1] * 1.1 : Math.max(d.v, d.r || 0, d.prev || 0) * 1.5;
  return Math.min(plafond, Math.max(base, 0.05));
}

function jauge(ctx, d, couleur, label) {
  return arcGauge({
    value: d.v, ref: ctx.ref ? d.r : null, max: echelleArc(d), color: couleur,
    label: label || d.k.short, fmt: d.k.fmt, chip: `<div class="st-arc-chips">${chipEvol(d.k, d.e)}</div>`,
  });
}

// Ligne generique : libelle + valeur, puis barre "bullet" pour un indicateur
// comparable (taux, prix moyens) ou simples pastilles pour un volume.
function ligne(ctx, d, couleur) {
  let visuel = "";
  if (estComparable(d.k)) {
    const pos = d.dist ? positionDansDist(d.dist, d.v) : null;
    const min = pos ? pos.min : 0;
    const max = pos ? pos.max : Math.max(d.v, d.r || 0, d.prev || 0) * 1.3 || 1;
    visuel = bullet({ value: d.v, ref: ctx.ref ? d.r : null, prev: d.prev, min, max, fmt: d.k.fmt, color: couleur, bornes: !!pos });
  }
  return `<div class="st-line">
      <div class="st-line-top"><span class="st-line-label">${esc(d.k.label)}</span><span class="st-line-val">${fmtValue(d.k.fmt, d.v)}</span></div>
      ${visuel}
      <div class="st-line-chips">${ctx.ref && estComparable(d.k) && d.r !== null ? `<span class="st-line-ref">réf. ${fmtValue(d.k.fmt, d.r)}</span>` : ""}${chipRef(ctx, d)}${chipEvol(d.k, d.e)}</div>
    </div>`;
}

// Grande carte chiffre : compteur anime + barres N-1 / N.
function carteHero(ctx, d, couleur) {
  return `<div class="st-hero-card" style="--tc:${couleur}">
      <div class="st-hero-label">${esc(d.k.label)}</div>
      <div class="st-hero-val" data-count="${d.v}" data-fmt="${d.k.fmt}">${fmtValue(d.k.fmt, d.v)}</div>
      <div class="st-hero-chips">${chipEvol(d.k, d.e)}${chipRef(ctx, d)}</div>
      ${pairBars({ cur: d.v, prev: d.prev, fmt: d.k.fmt, color: couleur })}
    </div>`;
}

// ------------------------------------------------------------- sections
function sectionActivite(ctx, g, used) {
  const out = [];
  const hero = ["CA", "Nb_Total"].map((key) => kv(ctx, key)).filter(Boolean);
  hero.forEach((d) => used.add(d.k.key));
  if (hero.length) out.push(`<div class="st-hero-pair">${hero.map((d, i) => carteHero(ctx, d, i ? "var(--c-examens)" : "var(--c-avis)")).join("")}</div>`);

  const nature = [["Nb_Total_Eqt", "Équipements", "var(--c-avis)"], ["Nb_Contacto", "Lentilles", "var(--c-impr)"], ["Nb_Vente_Comptoir", "Comptoir", "var(--c-examens)"]]
    .map(([key, label, color]) => { const d = kv(ctx, key); if (d) used.add(key); return d && d.v > 0 ? { label, value: d.v, color, extra: num0(d.v) } : null; })
    .filter(Boolean);
  if (nature.length >= 2) {
    const total = nature.reduce((a, p) => a + p.value, 0);
    out.push(`<div class="st-mini-title">Nature des ventes</div>${donut(nature, { centre: num0(total), sousCentre: "ventes" })}`);
  }

  const eq = [["Nb_Eqt1", "1er"], ["Nb_Eqt2", "2e (Duo)"], ["Nb_Eqt3", "3e"], ["Nb_Eqt4", "4e"]]
    .map(([key, label]) => { const d = kv(ctx, key); if (d) used.add(key); return d ? { label, cur: d.v, prev: d.prev, chip: chipEvol(d.k, d.e).replace(" <em>N-1</em>", "") } : null; })
    .filter(Boolean);
  if (eq.length >= 2) out.push(`<div class="st-mini-title">Équipements par dossier <small>barre claire = N-1</small></div>${columns(eq, { fmt: "int", color: "var(--c-avis)" })}`);
  return out.join("");
}

function sectionDuo(ctx, g, used) {
  const arcs = [["Tx_DuoPlus_Global", "Duo+ global"], ["Tx_DuoPlus_Libre", "Duo+ libre"], ["Tx_DuoPlus_Grille", "Duo+ grille"]]
    .map(([key, label]) => { const d = kv(ctx, key); if (d) used.add(key); return d ? jauge(ctx, d, g.color, label) : ""; })
    .filter(Boolean);
  return arcs.length ? `<div class="st-arcs">${arcs.join("")}</div>` : "";
}

function sectionPanier(ctx, g, used) {
  const out = [];
  const lignes = ["PM_Prog_Libre", "PM_Unif_Libre", "PM_Monture_Libre", "PM_Prog_Grille", "PM_Unif_Grille", "PM_Monture_Grille"]
    .map((key) => { const d = kv(ctx, key); if (d) used.add(key); return d ? ligne(ctx, d, g.color) : ""; })
    .filter(Boolean);
  if (lignes.length) out.push(`<div class="st-mini-title">Prix moyens <small>trait blanc = référence · rond = N-1</small></div><div class="st-lines">${lignes.join("")}</div>`);
  const lib = kv(ctx, "Nb_Ventes_Libre"), gri = kv(ctx, "Nb_Ventes_Grille");
  [lib, gri].forEach((d) => d && used.add(d.k.key));
  if (lib && gri) {
    out.push(stackedBar([{ label: "Tarif libre", value: lib.v, color: g.color }, { label: "Grille", value: gri.v, color: "var(--c-p4)" }], { titre: "Ventes : tarif libre vs grille" }));
  }
  return out.join("");
}

// Mix produit : les gammes classees par part, en podium.
function podiumMix(ctx) {
  const items = CAT.kpis
    .filter((k) => k.mix)
    .map((k) => ({ k, v: ctx.ent.v ? ctx.ent.v[ctx.ix[k.key]] : null, r: ctx.ref ? ctx.ref.v[ctx.ix[k.key]] : null }))
    .filter((x) => x.v !== null && x.v !== undefined && x.v > 0)
    .sort((a, b) => b.v - a.v);
  if (items.length < 3) return "";
  const marche = (it, rang) => `<div class="st-pod-step st-pod-step--${rang}">
      <div class="st-pod-name">${esc(it.k.short)}</div>
      <div class="st-pod-val">${fmtValue("pct", it.v)}</div>
      <div class="st-pod-ref">${it.r !== null && it.r !== undefined ? `réf. ${fmtValue("pct", it.r)}` : "&nbsp;"}</div>
      <div class="st-pod-block"><span>${rang}</span></div></div>`;
  const reste = items.slice(3);
  const max = items[0].v;
  return `<div class="st-mini-title">Mix produit${ctx.ref ? ` <small>comparé ${esc(ctx.refA)}</small>` : ""}</div>
    <div class="st-podium-card">
      <div class="st-podium">${marche(items[1], 2)}${marche(items[0], 1)}${marche(items[2], 3)}</div>
      ${reste.length ? `<div class="st-pod-rest">${reste.map((it, i) => `<div class="st-pod-row">
          <span class="st-pod-rank">${i + 4}</span><span class="st-pod-rname">${esc(it.k.short)}</span>
          <div class="st-pod-bar"><i class="st-anim-bar" data-w="${((it.v / max) * 100).toFixed(1)}"></i></div>
          <span class="st-pod-rval">${fmtValue("pct", it.v)}</span>
          <span class="st-pod-rref">${it.r !== null && it.r !== undefined ? `réf. ${fmtValue("pct", it.r)}` : ""}</span></div>`).join("")}</div>` : ""}
    </div>`;
}

function sectionVerres(ctx, g, used) {
  const out = [];
  const podium = podiumMix(ctx);
  CAT.kpis.filter((k) => k.mix).forEach((k) => used.add(k.key));
  if (podium) out.push(podium);
  const arcs = [["Tx_Transition", "Transitions"], ["Tx_Eyezen", "Eyezen"]]
    .map(([key, label]) => { const d = kv(ctx, key); if (d) used.add(key); return d ? jauge(ctx, d, g.color, label) : ""; })
    .filter(Boolean);
  if (arcs.length) out.push(`<div class="st-mini-title">Verres spécialisés</div><div class="st-arcs st-arcs--2">${arcs.join("")}</div>`);
  return out.join("");
}

function sectionOffres(ctx, g, used) {
  const out = [];
  const arcs = [["Tx_Reseaux", "Réseaux"], ["Tx_Panier_A", "Panier A"], ["Tx_C2S", "C2S"], ["Tx_100", "100 % Santé"]]
    .map(([key, label], i) => {
      const d = kv(ctx, key); if (d) used.add(key);
      return d ? jauge(ctx, d, ["var(--c-avis)", "var(--c-impr)", "var(--c-examens)", "var(--c-p4)"][i], label) : "";
    }).filter(Boolean);
  if (arcs.length) out.push(`<div class="st-arcs st-arcs--2">${arcs.join("")}</div>`);

  const forfaits = [["Nb_Forfait", "Forfaits", "var(--c-avis)"], ["Nb_100Sante", "100 % Santé", "var(--c-impr)"], ["Nb_Forfait_Junior", "Junior", "var(--c-examens)"],
    ["Nb_Forfait_RBA", "RBA", "var(--c-p4)"], ["Nb_Autre", "Autres", COULEUR_AUTRE]]
    .map(([key, label, color]) => { const d = kv(ctx, key); if (d) used.add(key); return d ? { label, value: d.v, color } : null; })
    .filter(Boolean);
  if (forfaits.length >= 2) out.push(stackedBar(forfaits, { titre: "Répartition des offres" }));

  const combos = (prefixe, titre, couleurs) => {
    const parts = ["AAA", "ABB", "BAA"].map((s, i) => { const d = kv(ctx, `${prefixe}_${s}`); if (d) used.add(`${prefixe}_${s}`); return d ? { label: s, value: d.v, color: couleurs[i] } : null; }).filter(Boolean);
    return parts.length >= 2 ? stackedBar(parts, { titre }) : "";
  };
  out.push(combos("C2S", "C2S : combinaisons", ["var(--c-examens)", "#fb5eae", "var(--c-avis)"]));
  out.push(combos("100", "100 % Santé : combinaisons", ["var(--c-impr)", "var(--c-p4)", "#ffd166"]));
  return out.join("");
}

function sectionDevis(ctx, g, used) {
  const out = [];
  const bloc = (titre, nbKey, caKey, couleur) => {
    const nb = kv(ctx, nbKey), ca = kv(ctx, caKey);
    [nb, ca].forEach((d) => d && used.add(d.k.key));
    if (!nb && !ca) return "";
    return `<div class="st-hero-card" style="--tc:${couleur}">
        <div class="st-hero-label">${esc(titre)}</div>
        ${nb ? `<div class="st-hero-val" data-count="${nb.v}" data-fmt="int">${fmtValue("int", nb.v)}</div>` : ""}
        ${ca ? `<div class="st-hero-sub">${fmtValue("eur", ca.v)}</div>` : ""}
      </div>`;
  };
  const duo = [bloc("Devis émis", "Devis_Emis_Nb", "Devis_Emis_CA", "var(--c-examens)"), bloc("Devis en cours", "Devis_EnCours_Nb", "Devis_EnCours_CA", "var(--c-avis)")].filter(Boolean);
  if (duo.length) out.push(`<div class="st-hero-pair">${duo.join("")}</div>`);
  const td = kv(ctx, "Tx_Devis");
  if (td) { used.add("Tx_Devis"); out.push(`<div class="st-arcs st-arcs--2">${jauge(ctx, td, g.color, "Taux de devis")}</div>`); }
  return out.join("");
}

function sectionLentilles(ctx, g, used) {
  const tuiles = [["Nb_Contacto", "var(--c-impr)"], ["CA_Contacto", "var(--c-avis)"], ["Nb_Lentilles_Essai", "var(--c-examens)"]]
    .map(([key, couleur]) => { const d = kv(ctx, key); if (d) used.add(key); return d ? carteHero(ctx, d, couleur) : ""; })
    .filter(Boolean);
  return tuiles.length ? `<div class="st-hero-trio">${tuiles.join("")}</div>` : "";
}

const CONSTRUCTEURS = {
  activite: sectionActivite, duo: sectionDuo, panier: sectionPanier, verres: sectionVerres,
  offres: sectionOffres, devis: sectionDevis, lentilles: sectionLentilles,
};

function sectionHTML(ctx, g) {
  const used = new Set();
  let html = (CONSTRUCTEURS[g.key] || (() => ""))(ctx, g, used);
  // tout indicateur de la famille non traite plus haut : ligne generique
  const restes = CAT.kpis
    .filter((k) => k.group === g.key && !k.mix && !used.has(k.key))
    .map((k) => kv(ctx, k.key))
    .filter(Boolean)
    .map((d) => ligne(ctx, d, g.color));
  if (restes.length) html += `<div class="st-mini-title">${html ? "Autres indicateurs" : "Indicateurs"}</div><div class="st-lines">${restes.join("")}</div>`;
  return html;
}

export function renderIndicators(root, ctx) {
  const wrap = document.createElement("div");
  const sections = CAT.groups
    .map((g) => ({ g, html: sectionHTML(ctx, g) }))
    .filter((s) => s.html.trim());

  if (!sections.length) {
    wrap.innerHTML = `<p class="empty-hint">Pas d'indicateur détaillé pour cette sélection.</p>`;
    root.appendChild(wrap);
    return;
  }

  const cadre = ctx.ref
    ? `Comparé ${esc(ctx.refA)} · <b class="st-lg-tick"></b> trait blanc = référence · <b class="st-lg-ring"></b> rond = N-1`
    : `Du ${fmtDateFr(ctx.payload.periode.debut, true)} au ${fmtDateFr(ctx.payload.periode.fin)} · variations vs N-1`;
  wrap.innerHTML = `
    <p class="st-note st-legend-line">${cadre}</p>
    <div class="st-jump">${sections.map(({ g }) => `<button data-jump="${g.key}" style="--gc:${g.color}">${icon(g.icon, 14)}<span>${esc(g.label.split(" ")[0] === "Spécifique" ? "Optic 2000" : g.label.split(" ")[0])}</span></button>`).join("")}</div>
    ${sections.map(({ g, html }) => `<section class="st-sec" id="sec-${g.key}" style="--gc:${g.color}">
        <div class="st-sec-head">${icon(g.icon, 18)}<span>${esc(g.label)}</span></div>${html}</section>`).join("")}`;
  root.appendChild(wrap);
  wrap.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () =>
    wrap.querySelector(`#sec-${b.dataset.jump}`).scrollIntoView({ behavior: "smooth", block: "start" })));
  animerGraphiques(wrap);
}
