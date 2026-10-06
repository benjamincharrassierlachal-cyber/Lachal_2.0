import { ringClusterSVG, animateRings } from "../../js/shapes.js";
import { icon } from "./icons.js";
import {
  CAT, fmtValue, fmtEvol, compareRef, estComparable, tone, relEvol, pillarColor, esc, fmtDateFr, num0, num1, zoneFor,
} from "./catalog.js";
import { sliderHTML, animateSliders, scoreChip, zonesBar } from "./gauge.js";
import { forcesEtFaiblesses, positionDansDist, decrire } from "./model.js";

// Couleur propre a chaque tuile "en chiffres".
const COULEUR_TUILE = {
  CA: "var(--c-avis)", Nb_Total: "var(--c-examens)", Tx_Transition: "var(--c-impr)", PM_Prog_Libre: "var(--c-p4)",
};

function el(html, cls) {
  const d = document.createElement("div");
  if (cls) d.className = cls;
  d.innerHTML = html;
  return d;
}

const plural = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;

function evolChip(kpi, e, suffixe = "") {
  const txt = kpi.evol ? fmtEvol(kpi.evol.kind, e, kpi.fmt) : null;
  if (!txt) return "";
  return `<span class="st-chip st-chip--${tone(kpi, e)}">${txt}${suffixe}</span>`;
}

// ---------------------------------------------------------------------
// Connexion : choix du magasin (ou admin) + code d'acces.
// opts.locked : {code, nom} quand cet appareil est deja affecte a un magasin :
// il n'est alors plus possible d'en choisir un autre (seul l'admin le peut).
export function renderLogin(root, manifest, opts, onSubmit) {
  const tri = manifest.magasins.slice().sort((a, b) => a.nom.localeCompare(b.nom));
  const locked = opts.locked || null;
  let modeAdmin = locked ? opts.role === "admin" : false;
  const wrap = el(`
    <div class="ob-center">
      <div class="ob-brand">Lachal Stats</div>
      <p class="sub" id="lg-sub">${locked ? "Saisissez votre code d'accès." : "Choisissez votre magasin puis saisissez votre code d'accès."}</p>
      <select class="ob-select" id="lg-select" ${locked ? "hidden" : ""}>
        <option value="" disabled ${opts.role ? "" : "selected"}>Choisir un magasin</option>
        ${tri.map((m) => `<option value="${esc(m.code)}" ${opts.role === "magasin" && opts.code === m.code ? "selected" : ""}>${esc(m.nom)}${m.ville ? " — " + esc(m.ville) : ""}</option>`).join("")}
        <option value="__admin" ${opts.role === "admin" ? "selected" : ""}>🔒 Espace admin</option>
      </select>
      <div class="st-lockbox" id="lg-lockbox" ${locked ? "" : "hidden"}>
        <span id="lg-lockname"></span><small id="lg-locksub"></small>
      </div>
      <div class="st-pwd">
        <input class="ob-select" id="lg-code" type="password" placeholder="Code d'accès" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
        <button type="button" class="st-pwd-eye" id="lg-eye" aria-label="Afficher le code">${icon("eye", 18)}</button>
      </div>
      <label class="st-check"><input type="checkbox" id="lg-remember" checked /> Mémoriser cet appareil</label>
      <p class="ob-error" id="lg-error" ${opts.error ? "" : "hidden"}>${esc(opts.error || "")}</p>
      <button class="ob-validate" id="lg-go" disabled>Entrer</button>
      ${locked ? `<button class="ob-back-link" id="lg-toggle"></button>` : ""}
      <p class="st-note" style="margin-top:18px">Le code n'est demandé qu'à la première connexion sur cet appareil.</p>
    </div>`, "onboarding onboarding--centered");
  root.appendChild(wrap);

  const select = wrap.querySelector("#lg-select");
  const code = wrap.querySelector("#lg-code");
  const go = wrap.querySelector("#lg-go");
  const err = wrap.querySelector("#lg-error");
  const toggle = wrap.querySelector("#lg-toggle");
  const cible = () => (locked ? (modeAdmin ? "__admin" : locked.code) : select.value);
  const maj = () => (go.disabled = !cible() || !code.value.trim());
  const dessiner = () => {
    if (!locked) return;
    wrap.querySelector("#lg-lockname").textContent = modeAdmin ? "🔒 Espace admin" : `🔒 ${locked.nom}`;
    wrap.querySelector("#lg-locksub").textContent = modeAdmin ? "Accès administrateur" : "Magasin de cet appareil";
    toggle.textContent = modeAdmin ? "← Revenir à mon magasin" : "Accès administrateur";
    maj();
  };
  if (toggle) toggle.addEventListener("click", () => { modeAdmin = !modeAdmin; err.hidden = true; code.value = ""; dessiner(); });
  dessiner();
  select.addEventListener("change", maj);
  code.addEventListener("input", maj);
  wrap.querySelector("#lg-eye").addEventListener("click", () => {
    code.type = code.type === "password" ? "text" : "password";
  });
  const valider = async () => {
    if (go.disabled) return;
    go.disabled = true;
    go.textContent = "Vérification…";
    err.hidden = true;
    const admin = cible() === "__admin";
    const res = await onSubmit({
      role: admin ? "admin" : "magasin",
      code: admin ? null : cible(),
      secret: code.value,
      remember: wrap.querySelector("#lg-remember").checked,
    });
    if (res && !res.ok) {
      err.textContent = res.msg;
      err.hidden = false;
      code.value = "";
      code.focus();
    }
    go.textContent = "Entrer";
    maj();
  };
  go.addEventListener("click", valider);
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") valider(); });
  if (opts.role || locked) code.focus();
}

// ---------------------------------------------------------------------
// Accueil : sante, anneaux des piliers, rang, forces, chiffres.
function tuile(ctx, key) {
  const k = CAT.byKey[key];
  const i = ctx.ix[key];
  const v = ctx.ent.v ? ctx.ent.v[i] : null;
  if (v === null || v === undefined) return "";
  const e = ctx.ent.e ? ctx.ent.e[i] : null;
  const r = ctx.ref ? ctx.ref.v[i] : null;
  const cmp = ctx.ref ? compareRef(k, v, r, ctx.partDe) : null;
  return `<div class="st-tile" style="--tc:${COULEUR_TUILE[key] || "var(--c-avis)"}">
      <div class="st-tile-label">${esc(k.short)}</div>
      <div class="st-tile-val">${fmtValue(k.fmt, v)}</div>
      <div class="st-tile-foot">
        ${evolChip(k, e, " <em>N-1</em>")}
        ${cmp ? `<span class="st-chip st-chip--${cmp.tone}">${cmp.txt}${cmp.ref ? " <em>réf.</em>" : ""}</span>` : ""}
      </div>
    </div>`;
}

function messageSansScore(ctx) {
  if (ctx.level === "seller") {
    return `Activité trop faible pour un score fiable (moins de ${CAT.health.minSellerSales} ventes ou ${num0(CAT.health.minSellerCA)} € de CA). Les indicateurs restent consultables.`;
  }
  if (ctx.kind === "ca") {
    return "Pour ce magasin, seul le CA comptable est disponible : le score de santé demande les indicateurs détaillés (Duo+, prix moyens, verres).";
  }
  return "Pas assez d'indicateurs pour calculer un score.";
}

export function renderHome(root, ctx, h) {
  const s = ctx.sante;
  const wrap = document.createElement("div");

  const titreSante = ctx.level === "group" ? "Santé du réseau" : "Santé";
  const zone = s ? zoneFor(s.score) : null;
  const refTxt = ctx.level === "group"
    ? `Moyenne des scores des ${plural(s ? s.count : 0, "magasin")} du réseau.`
    : `100 = le niveau ${esc(ctx.refDe || "de la référence")}. Plus on est haut, mieux on se porte.`;

  const carte = el(`
    <div class="st-health-head">
      <div><div class="st-eyebrow">${titreSante}</div>
        <div class="st-zone-name" style="color:${zone ? zone.color : "var(--text-dim)"}">${zone ? esc(zone.label) : "Pas de score"}</div></div>
      <div class="st-health-score" style="color:${zone ? zone.color : "var(--text-dim)"}">${s ? Math.round(s.score) : "–"}</div>
    </div>
    ${s ? sliderHTML(s.score) : ""}
    <p class="st-note">${s ? refTxt : messageSansScore(ctx)}</p>`, "card st-health");
  if (zone) carte.style.setProperty("--zc", zone.color);
  wrap.appendChild(carte);

  if (s) {
    const piliers = CAT.pillars.filter((p) => s.piliers[p.key] !== undefined);
    const rings = piliers.map((p) => ({ pct: s.piliers[p.key], color: pillarColor(p.key), icon: p.icon }));
    const hero = el(`
      <div class="ring-wrap ring-wrap--hero">
        ${ringClusterSVG(250, rings, h.shape, { icons: true })}
        <div class="score-center"><div class="score-value" style="color:${zone.color}">${Math.round(s.score)}</div></div>
      </div>
      <div class="st-pillars">
        ${piliers.map((p) => `<button class="st-pillar" data-pilier="${p.key}" style="--pc:${pillarColor(p.key)}">
            <span class="st-pillar-ico">${icon(p.icon, 16)}</span>
            <span class="st-pillar-val">${Math.round(s.piliers[p.key])}</span>
            <span class="st-pillar-lbl">${esc(p.label)}</span></button>`).join("")}
      </div>
      <p class="st-note st-pillars-hint">Touchez un pilier pour voir le détail de sa note</p>`, "hero");
    wrap.appendChild(hero);
    animateRings(hero);
    hero.querySelectorAll("[data-pilier]").forEach((b) => b.addEventListener("click", () => ouvrirDetailPilier(ctx, b.dataset.pilier)));

    if (ctx.rang) {
      const [r, n] = ctx.rang;
      const ou = ctx.level === "seller" ? "dans son magasin" : ctx.kind === "o2000" ? "dans le Groupe Optic 2000" : "dans le réseau";
      wrap.appendChild(el(`
        <div class="st-rank-ico">${icon("bars", 26)}</div>
        <div><div class="st-rank-big">${r}<sup>${r === 1 ? "er" : "e"}</sup> <small>sur ${n}</small></div>
        <div class="st-note" style="margin:0">${ou}${n >= 5 ? ` · top ${Math.max(1, Math.ceil((r / n) * 100))} %` : ""}</div></div>`, "card st-rank"));
    }
  }

  // --- niveau groupe : repartition des zones, podium, a accompagner
  if (ctx.level === "group" && s) {
    wrap.appendChild(el(`<div class="section-title">Répartition des magasins</div>`));
    wrap.appendChild(el(zonesBar(s.zones, s.count), "card"));
    const classes = ctx.children.filter((m) => m.sante && m.kind === "full").sort((a, b) => b.sante.score - a.sante.score);
    const ligne = (m, i, bas) => `<button class="st-row st-row--compact" data-store="${esc(m.code)}">
        <div class="st-row-rank">${bas ? classes.length - 2 + i : i + 1}</div>
        <div class="st-row-main"><div class="st-row-name">${esc(m.nom)}</div></div>${scoreChip(m.sante.score)}</button>`;
    wrap.appendChild(el(`<div class="section-title">En tête du classement</div>
      <div class="card st-list st-list--good">${classes.slice(0, 3).map((m, i) => ligne(m, i, false)).join("")}</div>
      <div class="section-title">À accompagner</div>
      <div class="card st-list st-list--bad">${classes.slice(-3).reverse().map((m, i) => ligne(m, i, true)).join("")}</div>`));
  }

  // --- forces / points d'attention
  if (ctx.ref && s) {
    const { forces, faibles } = forcesEtFaiblesses(ctx);
    // Resultat de l'entite en bout de ligne ; la reference reste sous le
    // libelle, avec la note de l'indicateur (ex. 144/160).
    const noteMax = CAT.health.indexMax;
    const bloc = (titre, liste, sens) => liste.length === 0 ? "" : `
      <div class="section-title">${titre}</div>
      <div class="card st-list st-list--${sens}">
        ${liste.map((l) => `<div class="st-li">
            <span class="st-li-ico st-li-ico--${sens}">${icon(sens === "good" ? "arrowUp" : "arrowDown", 16)}</span>
            <div class="st-li-main"><div class="st-li-label">${esc(l.label)}</div>
              <div class="st-li-sub"><span>réf. ${l.ref ?? "–"}</span><span class="st-li-note">${Math.round(l.idx)}/${noteMax}</span></div></div>
            <div class="st-li-res st-li-res--${sens}">${l.valeur ?? "–"}</div></div>`).join("")}
      </div>`;
    wrap.appendChild(el(bloc("Points forts", forces, "good") + bloc("À travailler", faibles, "bad")));
  }

  // --- en chiffres
  const cles = ["CA", "Nb_Total", "Tx_Transition", "PM_Prog_Libre"];
  const tuiles = cles.map((k) => tuile(ctx, k)).join("");
  if (tuiles) {
    wrap.appendChild(el(`<div class="section-title">En chiffres · du ${fmtDateFr(ctx.payload.periode.debut, true)} au ${fmtDateFr(ctx.payload.periode.fin)}</div>
      <div class="st-tiles">${tuiles}</div>`));
  }


  root.appendChild(wrap);
  animateSliders(wrap);
  wrap.querySelectorAll("[data-store]").forEach((b) => b.addEventListener("click", () => h.openStore(b.dataset.store)));
}

// ---------------------------------------------------------------------
// Detail d'un pilier : comment sa note est calculee, indicateur par indicateur.
function barreNote(idx, couleur) {
  const max = CAT.health.indexMax;
  return `<div class="st-note-bar"><i style="width:${Math.max(0, Math.min(100, (idx / max) * 100)).toFixed(1)}%;background:${couleur}"></i>
      <span class="st-note-tick" style="left:${((100 / max) * 100).toFixed(1)}%" title="100 = la référence"></span></div>`;
}

function corpsPilierEntite(ctx, p, couleur) {
  const s = ctx.sante;
  const ix = ctx.ix;
  const notes = [];
  const lignes = p.kpis.map((key) => {
    const k = CAT.byKey[key];
    const idx = s.idx[key];
    const nom = key === "CA" ? "Croissance du CA" : k.label;
    if (idx === undefined) {
      return `<div class="st-pd-row"><div class="st-pd-top"><span class="st-pd-label">${esc(nom)}</span></div>
        <div class="st-pd-formule">Pas de donnée pour cet indicateur.</div></div>`;
    }
    notes.push(idx);
    const d = decrire(ctx, key);
    let formule;
    if (p.mode === "growth") {
      const ecart = (ctx.ent.e[ix.CA] - ctx.ref.e[ix.CA]) * 100;
      formule = `Écart de croissance ${ecart > 0 ? "+" : ""}${num1(ecart)} pt → 100 + ${CAT.health.growthSlope / 100} × (${ecart > 0 ? "+" : ""}${num1(ecart)}) = ${Math.round(idx)}`;
    } else {
      formule = k.polarity === "down"
        ? `réf. ÷ valeur × 100 = ${Math.round(idx)}`
        : `valeur ÷ réf. × 100 = ${Math.round(idx)}`;
    }
    return `<div class="st-pd-row">
        <div class="st-pd-top"><span class="st-pd-label">${esc(nom)}</span><span class="st-pd-res" style="color:${couleur}">${d.valeur ?? "–"}</span></div>
        <div class="st-pd-sub"><span>réf. ${d.ref ?? "–"}</span><span class="st-li-note">${Math.round(idx)}/${CAT.health.indexMax}</span></div>
        ${barreNote(idx, couleur)}
        <div class="st-pd-formule">${formule}</div></div>`;
  });
  const poids = CAT.pillars.filter((x) => s.piliers[x.key] !== undefined);
  const part = Math.round(((p.weight || 1) / poids.reduce((a, x) => a + (x.weight || 1), 0)) * 100);
  const moyenne = notes.length > 1
    ? `Note du pilier = moyenne des notes ci-dessus : (${notes.map(num1).join(" + ")}) ÷ ${notes.length} = <strong>${num1(s.piliers[p.key])}</strong>.`
    : `Note du pilier = <strong>${num1(s.piliers[p.key])}</strong>.`;
  return `${lignes.join("")}
    <p class="st-pd-foot">${moyenne}<br>Ce pilier compte pour <strong>${part} %</strong> du score de santé. Chaque note est bornée entre ${CAT.health.indexMin} et ${CAT.health.indexMax} ; 100 = le niveau ${esc(ctx.refDe)}.</p>`;
}

function corpsPilierGroupe(ctx, p, couleur) {
  const liste = ctx.children
    .filter((m) => m.kind === "full" && m.sante && m.sante.piliers[p.key] !== undefined)
    .sort((a, b) => b.sante.piliers[p.key] - a.sante.piliers[p.key]);
  return `<p class="st-pd-foot" style="margin-top:0">Classement des ${liste.length} magasins sur ce pilier (note sur ${CAT.health.indexMax}, 100 = la moyenne du réseau).</p>
    ${liste.map((m, i) => `<div class="st-pd-row">
        <div class="st-pd-top"><span class="st-pd-label"><span class="st-row-rank" style="display:inline-block;width:24px">${i + 1}</span>${esc(m.nom)}</span>
          <span class="st-pd-res" style="color:${couleur}">${Math.round(m.sante.piliers[p.key])}</span></div>
        ${barreNote(m.sante.piliers[p.key], couleur)}</div>`).join("")}`;
}

function ouvrirDetailPilier(ctx, key) {
  const p = CAT.pillars.find((x) => x.key === key);
  const s = ctx.sante;
  if (!p || !s || s.piliers[key] === undefined) return;
  document.getElementById("st-sheet")?.remove();
  const couleur = pillarColor(key);
  const overlay = document.createElement("div");
  overlay.id = "st-sheet";
  overlay.className = "week-picker-overlay";
  overlay.innerHTML = `<div class="st-sheet" style="--pc:${couleur}">
      <div class="st-sheet-head">
        <div class="st-sheet-ico">${icon(p.icon, 22)}</div>
        <div class="st-sheet-title"><strong>${esc(p.label)}</strong><span>${esc(p.hint)}</span></div>
        <div class="st-sheet-note">${Math.round(s.piliers[key])}<small>/${CAT.health.indexMax}</small></div>
        <button class="icon-btn" data-close>${icon("close", 18)}</button>
      </div>
      <div class="st-sheet-body">${ctx.level === "group" ? corpsPilierGroupe(ctx, p, couleur) : corpsPilierEntite(ctx, p, couleur)}</div>
    </div>`;
  document.body.appendChild(overlay);
  const fermer = () => overlay.remove();
  overlay.addEventListener("click", (e) => { if (e.target === overlay) fermer(); });
  overlay.querySelector("[data-close]").addEventListener("click", fermer);
}

// ---------------------------------------------------------------------
// Equipe : magasins (admin) ou collaborateurs d'un magasin.
function ligneEquipe(item, rang, attr) {
  const sub = [];
  if (item.ca !== null && item.ca !== undefined) sub.push(`CA ${fmtValue("eur", item.ca)}`);
  if (item.evol !== null && item.evol !== undefined) {
    const t = item.evol > 0.0005 ? "good" : item.evol < -0.0005 ? "bad" : "flat";
    sub.push(`<span class="st-evol st-evol--${t}">${fmtEvol("pct", item.evol)}</span>`);
  }
  if (item.ventes) sub.push(`${num0(item.ventes)} ventes`);
  const zc = item.sante ? zoneFor(item.sante.score).color : "var(--surface-3)";
  return `<button class="st-row" ${attr}="${esc(item.key)}" style="--zc:${zc}">
      <div class="st-row-rank">${rang ?? ""}</div>
      <div class="st-row-main"><div class="st-row-name">${esc(item.nom)}${item.etiquette ? `<span class="st-row-badge">${esc(item.etiquette)}</span>` : ""}</div>
        <div class="st-row-sub">${sub.join(" · ") || "&nbsp;"}</div></div>
      ${item.sante ? scoreChip(item.sante.score) : `<span class="st-row-tag">${esc(item.tag || "")}</span>`}
    </button>`;
}

export function renderTeam(root, ctx, h, state) {
  const wrap = document.createElement("div");
  const ixCA = ctx.ix.CA;
  const ixNb = ctx.ix.Nb_Total;

  if (ctx.level === "group") {
    let items = ctx.children.map((m) => ({
      key: m.code, nom: m.nom, sante: m.sante,
      ca: m.kind === "ca" ? (m.compta ? m.compta.n : null) : (m.v ? m.v[ixCA] : null),
      evol: m.kind === "ca" ? (m.compta ? m.compta.evol : null) : (m.e ? m.e[ixCA] : null),
      ventes: m.v ? m.v[ixNb] : null, tag: m.kind === "ca" ? "CA seul" : "", kind: m.kind,
      etiquette: m.kind === "o2000" ? "Optic 2000" : "",
    }));
    const tris = {
      score: (a, b) => (b.sante ? b.sante.score : -1) - (a.sante ? a.sante.score : -1),
      ca: (a, b) => (b.ca ?? -1) - (a.ca ?? -1),
      evol: (a, b) => (b.evol ?? -9) - (a.evol ?? -9),
      nom: (a, b) => a.nom.localeCompare(b.nom),
    };
    if (state.zone) items = items.filter((i) => i.sante && i.sante.zone === state.zone);
    items.sort(tris[state.sort] || tris.score);
    wrap.appendChild(el(`
      <div class="st-chips">
        ${[["score", "Santé"], ["ca", "CA"], ["evol", "Évolution"], ["nom", "Nom"]]
          .map(([k, l]) => `<button class="admin-sort-btn ${state.sort === k ? "active" : ""}" data-sort="${k}">${l}</button>`).join("")}
      </div>
      <div class="st-chips">
        <button class="admin-sort-btn ${!state.zone ? "active" : ""}" data-zone="">Toutes zones</button>
        ${CAT.zones.map((z) => `<button class="admin-sort-btn ${state.zone === z.key ? "active" : ""}" data-zone="${z.key}" style="${state.zone === z.key ? `background:${z.color};border-color:${z.color}` : `color:${z.color}`}">${esc(z.label)}</button>`).join("")}
      </div>`));
    // rang affiche uniquement pour le reseau principal (Optic 2000 se classe
    // a part, avec sa propre reference)
    const rangs = {};
    ctx.children.filter((m) => m.rang && m.kind === "full").forEach((m) => (rangs[m.code] = m.rang[0]));
    wrap.appendChild(el(items.length
      ? items.map((i) => ligneEquipe(i, state.sort === "score" && !state.zone ? rangs[i.key] : "", "data-store")).join("")
      : `<p class="empty-hint">Aucun magasin dans cette zone.</p>`, "st-rows"));
  } else {
    const vendeurs = ctx.children;
    const items = vendeurs.map((s) => ({
      key: s.nom, nom: s.nom, sante: s.sante, ca: s.v ? s.v[ixCA] : null, evol: s.e ? s.e[ixCA] : null,
      ventes: s.v ? s.v[ixNb] : null, actif: s.actif,
      rang: s.rang ? s.rang[0] : "",
    }));
    const actifs = items.filter((i) => i.actif).sort((a, b) => (b.sante ? b.sante.score : -1) - (a.sante ? a.sante.score : -1));
    const faibles = items.filter((i) => !i.actif);
    wrap.appendChild(el(`<p class="st-note" style="margin-top:12px">Classés par score de santé, comparés au magasin (${plural(actifs.length, "collaborateur")} actif${actifs.length > 1 ? "s" : ""}).</p>`));
    wrap.appendChild(el(actifs.length
      ? actifs.map((i) => ligneEquipe(i, i.rang, "data-seller")).join("")
      : `<p class="empty-hint">Aucun collaborateur avec une activité suffisante.</p>`, "st-rows"));
    if (faibles.length) {
      wrap.appendChild(el(`<details class="st-more"><summary>Activité faible ou ponctuelle (${faibles.length})</summary>
        <div class="st-rows">${faibles.map((i) => ligneEquipe({ ...i, sante: null, tag: "—" }, "", "data-seller")).join("")}</div></details>`));
    }
  }

  root.appendChild(wrap);
  wrap.querySelectorAll("[data-store]").forEach((b) => b.addEventListener("click", () => h.openStore(b.dataset.store)));
  wrap.querySelectorAll("[data-seller]").forEach((b) => b.addEventListener("click", () => h.openSeller(b.dataset.seller)));
  wrap.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => state.setSort(b.dataset.sort)));
  wrap.querySelectorAll("[data-zone]").forEach((b) => b.addEventListener("click", () => state.setZone(b.dataset.zone || null)));
}

// ---------------------------------------------------------------------
// Evolution : CA comptable N-2 / N-1 / N, courbe des exports, ce qui bouge.
function barresCompta(ctx) {
  const c = ctx.ent.compta;
  if (!c) {
    return `<p class="st-note">Le CA comptable est disponible par magasin et pour le groupe, pas par collaborateur.</p>`;
  }
  const annee = parseInt(ctx.payload.periode.fin.slice(0, 4), 10);
  const valeurs = [[annee - 2, c.n2], [annee - 1, c.n1], [annee, c.n]];
  const max = Math.max(...valeurs.map(([, v]) => v || 0), 1);
  const couleurs = ["var(--c-p4)", "var(--c-examens)", "var(--c-avis)"];
  const evol = c.evol === null || c.evol === undefined ? null : c.evol;
  return `<div class="st-bars">
      ${valeurs.map(([a, v], i) => `<div class="st-bar">
          <div class="st-bar-val">${v ? (v >= 1e6 ? (v / 1e6).toFixed(2).replace(".", ",") + " M€" : num0(v / 1000) + " k€") : "–"}</div>
          <div class="st-bar-col"><i style="height:${v ? Math.max(4, (v / max) * 100) : 0}%;background:${couleurs[i]}"></i></div>
          <div class="st-bar-year">${a}</div></div>`).join("")}
    </div>
    <div class="st-bars-foot">
      ${evol !== null ? `<span class="st-chip st-chip--${tone(CAT.byKey.CA, evol)}">${fmtEvol("pct", evol)} <em>vs ${annee - 1}</em></span>` : `<span class="st-chip st-chip--flat">pas de comparaison</span>`}
      <span class="st-note" style="margin:0">du 1er janv. au ${fmtDateFr(ctx.payload.periode.compta_fin)}</span>
    </div>`;
}

function courbe(points, couleur, fmt) {
  const w = 320, hgt = 100, pad = 10;
  const vals = points.map((p) => p.y);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pas = (w - pad * 2) / (points.length - 1);
  const xy = points.map((p, i) => [pad + i * pas, hgt - pad - ((p.y - min) / span) * (hgt - pad * 2)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${hgt}" width="100%" height="${hgt}" preserveAspectRatio="none">
      <path d="${d}" fill="none" stroke="${couleur}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
      ${xy.map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${couleur}"><title>${fmtDateFr(points[i].s)} : ${fmtValue(fmt, points[i].y)}</title></circle>`).join("")}
    </svg>
    <div class="chart-range"><span>${fmtDateFr(points[0].s, true)}</span><span>${fmtDateFr(points[points.length - 1].s, true)}</span></div>`;
}

export function renderEvolution(root, ctx) {
  const wrap = document.createElement("div");
  wrap.appendChild(el(`<div class="section-title">CA comptable</div>`));
  wrap.appendChild(el(barresCompta(ctx), "card"));

  const hist = (ctx.ent.hist || []);
  const caPts = hist.filter((x) => x.ca !== null && x.ca !== undefined).map((x) => ({ s: x.s, y: x.ca }));
  const scPts = hist.filter((x) => x.score !== null && x.score !== undefined).map((x) => ({ s: x.s, y: x.score }));
  wrap.appendChild(el(`<div class="section-title">Au fil des exports</div>`));
  if (caPts.length >= 2 || scPts.length >= 2) {
    wrap.appendChild(el(`
      ${caPts.length >= 2 ? `<div class="st-card-head" style="color:var(--c-avis)">${icon("trending", 16)}<span>CA cumulé</span></div>${courbe(caPts, "var(--c-avis)", "eur")}` : ""}
      ${scPts.length >= 2 ? `<div class="st-card-head" style="color:var(--c-impr);margin-top:14px">${icon("pulse", 16)}<span>Score de santé</span></div>${courbe(scPts, "var(--c-impr)", "dec")}` : ""}`, "card"));
  } else {
    wrap.appendChild(el(`<p class="st-note" style="margin:0">Un seul export pour l'instant (${fmtDateFr(ctx.payload.periode.fin)}). Les courbes apparaîtront dès le prochain export (les 5 et 20 du mois).</p>`, "card"));
  }

  // ce qui bouge vs N-1
  const mouvements = [];
  CAT.kpis.forEach((k) => {
    const i = ctx.ix[k.key];
    const v = ctx.ent.v ? ctx.ent.v[i] : null;
    const e = ctx.ent.e ? ctx.ent.e[i] : null;
    const rel = relEvol(k, v, e);
    if (rel === null || v === null || !k.evol) return;
    if (k.key === "Nb_Total_Eqt" || k.key.startsWith("Nb_Eqt")) return;
    mouvements.push({ k, rel, v, e });
  });
  mouvements.sort((a, b) => b.rel - a.rel);
  const ligne = (m) => `<div class="st-li"><div class="st-li-main"><div class="st-li-label">${esc(m.k.label)}</div>
      <div class="st-li-sub">${fmtValue(m.k.fmt, m.v)}</div></div>${evolChip(m.k, m.e)}</div>`;
  if (mouvements.length >= 4) {
    wrap.appendChild(el(`<div class="section-title">Plus fortes hausses vs N-1</div><div class="card st-list">${mouvements.slice(0, 4).map(ligne).join("")}</div>
      <div class="section-title">Plus forts reculs vs N-1</div><div class="card st-list">${mouvements.slice(-4).reverse().map(ligne).join("")}</div>`));
  }
  root.appendChild(wrap);
}

// ---------------------------------------------------------------------
export function renderSettings(root, info, cb) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="settings-top"><h2>Réglages</h2></div>
    <div class="setting-block"><div class="label">Forme des anneaux</div>
      <div class="shape-options">
        ${["circle", "pentagon", "hexagon"].map((s) => `<button class="opt-btn ${info.shape === s ? "active" : ""}" data-shape="${s}">${icon(s, 26)}<span>${s === "circle" ? "Cercle" : s === "pentagon" ? "Pentagone" : "Hexagone"}</span></button>`).join("")}
      </div></div>
    <div class="setting-block"><div class="label">Palette de couleurs</div>
      <div class="theme-options">
        ${[["aurora", "#ff9f1c", "#a78bfa", "#2dd4bf"], ["sunset", "#fb5eae", "#7c83fd", "#3ddc97"], ["neon", "#ff2ea6", "#7cf7ff", "#c6ff3d"]]
          .map(([key, a, b, c]) => `<button class="opt-btn ${info.theme === key ? "active" : ""}" data-theme="${key}"><div class="theme-swatch"><i style="background:${a}"></i><i style="background:${b}"></i><i style="background:${c}"></i></div><span>${key[0].toUpperCase() + key.slice(1)}</span></button>`).join("")}
      </div></div>
    <div class="setting-block"><div class="label">Comment est calculé le score de santé</div>
      <div class="card st-explain">
        <p>Le score compare, pilier par pilier, l'entité à son <strong>instance supérieure</strong> : un magasin à tous les magasins, un collaborateur à son magasin. <strong>100 = la référence</strong> (la moyenne).</p>
        ${CAT.pillars.map((p) => `<div class="st-explain-row"><span class="st-dot" style="background:${pillarColor(p.key)}"></span><div><strong>${esc(p.label)}</strong><br><span>${esc(p.hint)}</span></div></div>`).join("")}
        <p>Le score est la moyenne des piliers disponibles (au moins ${CAT.health.minPillars}). Un collaborateur n'a de score qu'à partir de ${CAT.health.minSellerSales} ventes et ${num0(CAT.health.minSellerCA)} € de CA.</p>
        <div class="st-explain-zones">${CAT.zones.map((z, i) => `<span style="--z:${z.color}">${esc(z.label)}<small>${i === 0 ? `< ${z.max}` : z.max > 9000 ? `≥ ${CAT.zones[i - 1].max}` : `${CAT.zones[i - 1].max}–${z.max}`}</small></span>`).join("")}</div>
      </div></div>
    <div class="setting-block"><div class="label">Données</div>
      <div class="card st-explain"><p>Période : du <strong>${fmtDateFr(info.periode.debut)}</strong> au <strong>${fmtDateFr(info.periode.fin)}</strong> (CA comptable jusqu'au ${fmtDateFr(info.periode.compta_fin)}).<br>Mises à jour les 5 et 20 de chaque mois.<br>${info.nbExports > 1 ? `${info.nbExports} exports en historique.` : "1 export en historique."}</p></div></div>
    <div class="setting-block"><div class="label">Accès</div>
      ${info.role === "admin" ? `
        <button class="card" style="width:100%;text-align:left" data-switch><strong>${esc(info.qui)}</strong><div class="about-text-sm" style="margin-top:2px">Me déconnecter de cet appareil</div></button>
        ${info.locked ? `<button class="card" style="width:100%;text-align:left;margin-top:10px" data-unlock><strong>Déverrouiller cet appareil</strong><div class="about-text-sm" style="margin-top:2px">Actuellement réservé à ${esc(info.locked.nom)} : permet de l'affecter à un autre magasin.</div></button>` : ""}`
      : `<div class="card" style="width:100%;text-align:left"><strong>${esc(info.qui)}</strong><div class="about-text-sm" style="margin-top:2px">Cet appareil est réservé à ce magasin.</div></div>`}
    </div>
    <div class="setting-block"><a class="card st-homelink" href="../"><strong>← Accueil Lachal 2.0</strong><div class="about-text-sm" style="margin-top:2px">Passer à Suivi &amp; Trophées</div></a></div>
    <p class="about-text">Les données sont chiffrées : seul le bon code d'accès permet de les lire, et rien n'est envoyé ailleurs que sur cet appareil.</p>`;
  root.appendChild(wrap);
  wrap.querySelectorAll("[data-shape]").forEach((b) => b.addEventListener("click", () => cb.setShape(b.dataset.shape)));
  wrap.querySelectorAll("[data-theme]").forEach((b) => b.addEventListener("click", () => cb.setTheme(b.dataset.theme)));
  wrap.querySelector("[data-switch]")?.addEventListener("click", cb.logout);
  wrap.querySelector("[data-unlock]")?.addEventListener("click", cb.unlock);
}
