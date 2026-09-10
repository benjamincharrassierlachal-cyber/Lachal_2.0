import { ringClusterSVG } from "./shapes.js";
import { icon } from "./icons.js";
import { buildBadges, bestCurrentStreaks } from "./badges.js";
import { ADMIN_CODE } from "./data.js";

const ADMIN_PASSWORD = "BDG*24";

function weekLabel(semaine) {
  if (!semaine) return "";
  const [, s] = semaine.split("-S");
  return `Semaine ${parseInt(s, 10)}`;
}

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function fmtNum(v) {
  return v === null || v === undefined ? "-" : v;
}

function statusChip(status) {
  if (status === "gold") return `<span class="chip gold">OR</span>`;
  if (status === "met") return `<span class="chip met">${icon("check", 12)}</span>`;
  if (status === "miss") return `<span class="chip miss">-</span>`;
  return "";
}

// ---------------------------------------------------------------------
export function renderOnboarding(root, data, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "onboarding onboarding--centered";
  const sorted = data.stores.slice().sort((a, b) => a.name.localeCompare(b.name));
  wrap.innerHTML = `
    <div class="ob-center" id="ob-step-select">
      <div class="ob-brand">Lachal 2.0</div>
      <p class="sub">Choisissez votre magasin : cet appareil s'en souviendra.</p>
      <select class="ob-select" id="ob-select">
        <option value="" disabled selected>Choisir un magasin</option>
        ${sorted.map((s) => `<option value="${s.code}">${s.name} — ${s.ville}</option>`).join("")}
        <option value="${ADMIN_CODE}">🔒 Espace admin</option>
      </select>
      <button class="ob-validate" id="ob-validate" disabled>Valider</button>
    </div>
    <div class="ob-center" id="ob-step-password" hidden>
      <div class="ob-brand">🔒 Espace admin</div>
      <p class="sub">Mot de passe requis.</p>
      <input type="password" class="ob-select" id="ob-password" placeholder="Mot de passe" autocomplete="off" />
      <p class="ob-error" id="ob-error" hidden>Mot de passe incorrect.</p>
      <button class="ob-validate" id="ob-password-go">Entrer</button>
      <button class="ob-back-link" id="ob-password-cancel">← Retour</button>
    </div>
  `;
  root.appendChild(wrap);

  const stepSelect = wrap.querySelector("#ob-step-select");
  const stepPassword = wrap.querySelector("#ob-step-password");
  const select = wrap.querySelector("#ob-select");
  const validate = wrap.querySelector("#ob-validate");
  const pwdInput = wrap.querySelector("#ob-password");
  const pwdError = wrap.querySelector("#ob-error");

  select.addEventListener("change", () => {
    validate.disabled = !select.value;
  });
  validate.addEventListener("click", () => {
    if (!select.value) return;
    if (select.value === ADMIN_CODE) {
      stepSelect.hidden = true;
      stepPassword.hidden = false;
      pwdInput.focus();
    } else {
      onPick(select.value);
    }
  });

  const tryPassword = () => {
    if (pwdInput.value === ADMIN_PASSWORD) {
      onPick(ADMIN_CODE);
    } else {
      pwdError.hidden = false;
      pwdInput.value = "";
      pwdInput.focus();
    }
  };
  wrap.querySelector("#ob-password-go").addEventListener("click", tryPassword);
  pwdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryPassword();
  });
  wrap.querySelector("#ob-password-cancel").addEventListener("click", () => {
    stepPassword.hidden = true;
    stepSelect.hidden = false;
    pwdError.hidden = true;
  });
}

// ---------------------------------------------------------------------
// Ecran de recompense : trophees debloques mais pas encore "recuperes",
// presentes avant l'accueil au demarrage de l'appli.
export function renderRewards(root, badges, cb) {
  const wrap = document.createElement("div");
  wrap.className = "onboarding rewards-screen";
  wrap.innerHTML = `
    <div class="rewards-head">
      <div class="rewards-title">Nouveaux trophées !</div>
      <p class="sub">${badges.length} trophée${badges.length > 1 ? "s" : ""} débloqué${badges.length > 1 ? "s" : ""} depuis votre dernière visite.</p>
      ${badges.length > 1 ? `<button class="ob-validate" id="claim-all">Tout récupérer</button>` : ""}
    </div>
    <div class="badge-grid rewards-grid">
      ${badges
        .map(
          (b) => `<div class="card badge-card">
            <img class="badge-img" src="icons/badges/${b.image}" width="56" height="56" alt="" />
            <div class="b-name">${b.name}</div>
            <div class="b-desc">${b.descUnlocked}</div>
            <button class="claim-btn" data-claim="${b.id}">Récupérer</button>
          </div>`
        )
        .join("")}
    </div>
  `;
  root.appendChild(wrap);

  wrap.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.addEventListener("click", () => cb.claim(btn.dataset.claim));
  });
  wrap.querySelector("#claim-all")?.addEventListener("click", () => cb.claimAll());
}

// ---------------------------------------------------------------------
export function renderDashboard(root, model, settings, nav) {
  const { store, metrics, currentWeek } = model;
  if (!currentWeek || !metrics.length) {
    root.innerHTML = `<p class="empty-hint">Pas encore de releve cette semaine pour ${store.name}.</p>`;
    return;
  }

  const rings = metrics.map((m) => ({
    pct: currentWeek.metrics[m.key].pct,
    color: `var(${m.colorVar})`,
    icon: m.icon,
  }));

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="ring-wrap ring-wrap--hero">
      ${ringClusterSVG(276, rings, settings.shape, { icons: true })}
      <div class="score-center">
        <div class="score-value">${currentWeek.score ?? "-"}%</div>
      </div>
    </div>
    <div class="stat-row">
      ${metrics
        .map((m) => {
          const pm = currentWeek.metrics[m.key];
          return `<div class="stat-pill">
            <span class="val" style="color:var(${m.colorVar})">${fmtNum(pm.value)}/${fmtNum(pm.objective)}</span>
            <span class="lbl">${m.short}</span>
          </div>`;
        })
        .join("")}
    </div>
  `;
  root.appendChild(hero);

  const hasNote = currentWeek.note !== null && currentWeek.note !== undefined;

  const list = document.createElement("div");
  list.className = "metric-list";
  list.innerHTML = metrics
    .map((m) => {
      const pm = currentWeek.metrics[m.key];
      const pct = pm.pct ?? 0;
      return `<button class="card metric-card" data-nav="metric" data-key="${m.key}">
        <div class="m-icon" style="background:color-mix(in srgb, var(${m.colorVar}) 30%, transparent); color:var(${m.colorVar})">${icon(m.icon, 30)}</div>
        <div class="m-body">
          <div class="m-top">
            <span class="m-label">${m.label}</span>
            <span class="m-pct" style="color:var(${m.colorVar})">${pm.pct === null ? "-" : pm.pct + "%"}</span>
          </div>
          <div class="m-nums">${fmtNum(pm.value)} <span style="color:var(--text-dim);font-weight:500;">/ objectif ${fmtNum(pm.objective)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, pct)}%; background:var(${m.colorVar})"></div></div>
          ${m.key === "avis" && hasNote
            ? `<div class="m-note"><span>Note Google actuelle</span><span class="mono" style="color:var(${m.colorVar})">${currentWeek.note.toFixed(1)} ★</span></div>`
            : ""}
        </div>
      </button>`;
    })
    .join("");
  root.appendChild(list);

  const badges = buildBadges(model, settings.visits);
  const unlocked = badges.filter((b) => b.unlocked);
  const preview = (unlocked.length ? unlocked.slice(-4).reverse() : badges.slice(0, 4));

  const trophySection = document.createElement("div");
  trophySection.innerHTML = `
    <div class="section-title">Trophees</div>
    <div class="badges-preview">
      ${preview
        .map(
          (b) => `<div class="badge-mini">
            <img class="badge-img ${b.unlocked ? "" : "locked"}" src="icons/badges/${b.image}" width="52" height="52" alt="" />
            <span>${b.name}</span>
          </div>`
        )
        .join("")}
    </div>
    <p class="trophy-count">${unlocked.length} trophee(s) obtenu(s) sur ${badges.length}</p>
  `;
  root.appendChild(trophySection);

  root.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", () => nav(el.dataset.nav, el.dataset.key));
  });
}

// ---------------------------------------------------------------------
// Vue d'ensemble admin : cumul du groupe + liste de tous les magasins.
export function renderAdmin(root, adminModel, settings, rows, cb) {
  const { metricsAgg, score, weekLabel } = adminModel;

  if (!metricsAgg.length) {
    root.innerHTML = `<p class="empty-hint">Aucune donnee disponible.</p>`;
    return;
  }

  const rings = metricsAgg.map((m) => ({ pct: m.pct, color: `var(${m.colorVar})`, icon: m.icon }));

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="ring-wrap ring-wrap--hero">
      ${ringClusterSVG(276, rings, settings.shape, { icons: true })}
      <div class="score-center">
        <div class="score-value">${score ?? "-"}%</div>
      </div>
    </div>
    <div class="stat-row">
      ${metricsAgg
        .map(
          (m) => `<div class="stat-pill">
            <span class="val" style="color:var(${m.colorVar})">${fmtNum(m.value)}/${fmtNum(m.objective)}</span>
            <span class="lbl">${m.short}</span>
          </div>`
        )
        .join("")}
    </div>
  `;
  root.appendChild(hero);

  const section = document.createElement("div");
  section.innerHTML = `
    <div class="admin-list-head">
      <div class="section-title" style="margin:0;">Magasins${weekLabel ? " — " + weekLabel.replace("-S", " semaine ") : ""}</div>
      <div class="admin-sort">
        ${[["score", "Score"], ["name", "Nom"], ["trophies", "Trophées"]]
          .map(([key, label]) => `<button class="admin-sort-btn ${cb.sort === key ? "active" : ""}" data-sort="${key}">${label}</button>`)
          .join("")}
      </div>
    </div>
    <div class="admin-list">
      ${rows
        .map((r) => {
          const boxes = ["avis", "examens", "impressions"]
            .map((key) => {
              const m = METRIC_BY_KEY[key];
              const pm = r.model.currentWeek?.metrics[key];
              if (!pm) return `<span class="admin-box admin-box--off">·</span>`;
              const bg =
                pm.status === "gold" ? "var(--gold)" : pm.status === "met" ? `var(${m.colorVar})` : pm.status === "miss" ? "var(--danger)" : "var(--track)";
              const txt = pm.pct === null ? "-" : `${pm.pct}%`;
              return `<span class="admin-box" style="background:${bg}">${txt}</span>`;
            })
            .join("");
          return `<button class="admin-row" data-store="${r.store.code}">
            <div class="admin-row-top">
              <span class="admin-row-name">${r.store.name}</span>
              <span class="admin-row-score">${r.model.currentWeek?.score ?? "-"}%</span>
            </div>
            <div class="admin-row-bottom">
              <div class="admin-boxes">${boxes}</div>
              <span class="admin-trophies">${icon("trophy", 13)} ${r.trophies.unlocked}/${r.trophies.total}</span>
            </div>
          </button>`;
        })
        .join("")}
    </div>
  `;
  root.appendChild(section);

  section.querySelectorAll("[data-sort]").forEach((b) =>
    b.addEventListener("click", () => cb.setSort(b.dataset.sort))
  );
  section.querySelectorAll("[data-store]").forEach((b) =>
    b.addEventListener("click", () => cb.selectStore(b.dataset.store))
  );
}

const METRIC_BY_KEY = { avis: { colorVar: "--c-avis" }, examens: { colorVar: "--c-examens" }, impressions: { colorVar: "--c-impr" } };

// ---------------------------------------------------------------------
export function renderMetricDetail(root, model, metricKey, settings) {
  const m = model.metrics.find((x) => x.key === metricKey);
  const cur = model.currentWeek;
  if (!m || !cur) {
    root.innerHTML = `<p class="empty-hint">Donnee indisponible.</p>`;
    return;
  }
  const pm = cur.metrics[m.key];
  const streaksInfo = bestCurrentStreaks(model)[m.key];

  const firstIdx = model.history.findIndex((w) => {
    const v = w.metrics[m.key]?.value;
    return v !== null && v !== undefined;
  });
  const relevant = firstIdx === -1 ? [] : model.history.slice(firstIdx);

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button class="icon-btn" data-back style="margin-top:6px;">${icon("chevronLeft", 20)}</button>
    <div class="detail-hero">
      <div class="ring-wrap">
        ${ringClusterSVG(108, [{ pct: pm.pct, color: `var(${m.colorVar})` }], settings.shape)}
        <div class="score-center"><div class="score-value">${pm.pct === null ? "-" : pm.pct + "%"}</div></div>
      </div>
      <div>
        <div class="big-num" style="color:var(${m.colorVar})">${fmtNum(pm.value)}</div>
        <div class="big-sub">${m.verbe}, objectif ${fmtNum(pm.objective)}</div>
      </div>
    </div>

    <div class="streak-row">
      <div class="card streak-card"><div class="n" style="color:var(${m.colorVar})">${streaksInfo.current}</div><div class="l">Serie en cours</div></div>
      <div class="card streak-card"><div class="n">${streaksInfo.best}</div><div class="l">Meilleure serie</div></div>
    </div>

    <div class="section-title">${m.label} — dernieres semaines</div>
    ${relevant.length === 0 ? `<p class="empty-hint">Pas encore de releve pour cet indicateur.</p>` : `
    <div class="sparkline">
      ${(() => {
        const slice = relevant.slice(-14);
        const validPcts = slice.map((w) => w.metrics[m.key]?.pct).filter((p) => p !== null && p !== undefined);
        const maxP = Math.max(100, ...validPcts, 1);
        return slice
          .map((w) => {
            const wm = w.metrics[m.key];
            const p = wm?.pct;
            let h, color;
            if (p === null || p === undefined) {
              h = 3;
              color = "var(--track)";
            } else {
              h = Math.max(4, (p / maxP) * 52);
              color = wm.status === "gold" ? "var(--gold)" : wm.status === "miss" ? "var(--danger)" : `var(${m.colorVar})`;
            }
            return `<div class="bar" style="height:${h}px;background:${color}" title="${weekLabel(w.semaine)}"></div>`;
          })
          .join("");
      })()}
    </div>

    <table class="history">
      <thead><tr><th>Semaine</th><th>Realise</th><th></th></tr></thead>
      <tbody>
        ${relevant
          .slice()
          .reverse()
          .slice(0, 12)
          .map((w) => {
            const wm = w.metrics[m.key];
            return `<tr>
              <td>${weekLabel(w.semaine)}</td>
              <td class="num">${fmtNum(wm.value)}/${fmtNum(wm.objective)} ${wm.pct !== null ? `<span style="color:var(--text-dim)">${wm.pct}%</span>` : ""}</td>
              <td>${statusChip(wm.status)}</td>
            </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    <p class="best-streak-note">Meilleure serie : ${streaksInfo.best} semaine${streaksInfo.best > 1 ? "s" : ""} d'objectif tenu d'affilee.</p>
    `}
  `;
  root.appendChild(wrap);
}

// ---------------------------------------------------------------------
export function renderTrophies(root, model, settings) {
  const badges = buildBadges(model, settings.visits);
  const order = ["Combo", "Semaine", "Series", "Records", "Exploits", "Seuils", "Notes", "Paliers", "Assiduite", "Collection"];
  const byCat = {};
  badges.forEach((b) => (byCat[b.category] ||= []).push(b));

  const wrap = document.createElement("div");
  const unlockedCount = badges.filter((b) => b.unlocked).length;
  wrap.innerHTML = `<div class="section-title" style="margin-top:12px;">${unlockedCount} / ${badges.length} trophees obtenus</div>`;

  order
    .filter((cat) => byCat[cat])
    .forEach((cat) => {
      const section = document.createElement("div");
      section.innerHTML = `<div class="section-title">${cat}</div>
        <div class="badge-grid">
          ${byCat[cat]
            .map(
              (b) => `<div class="card badge-card ${b.unlocked ? "" : "locked"}">
                <img class="badge-img ${b.unlocked ? "" : "locked"}" src="icons/badges/${b.image}" width="56" height="56" alt="" />
                <div class="b-name">${b.name}</div>
                <div class="b-desc">${b.unlocked ? b.descUnlocked : b.descLocked}</div>
                ${b.progress && !b.unlocked ? `<div class="b-progress" style="color:${b.color}">${b.progress}</div>` : ""}
              </div>`
            )
            .join("")}
        </div>`;
      wrap.appendChild(section);
    });
  root.appendChild(wrap);
}

// ---------------------------------------------------------------------
export function renderSettings(root, data, settings, cb) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <div class="settings-top">
      <h2>Reglages</h2>
      <button class="icon-btn" data-save title="Enregistrer et revenir">${icon("save", 20)}</button>
    </div>
    <div class="setting-block">
      <div class="label">Forme des anneaux</div>
      <div class="shape-options">
        ${["circle", "pentagon", "hexagon"]
          .map(
            (s) => `<button class="opt-btn ${settings.shape === s ? "active" : ""}" data-shape="${s}">
              ${icon(s, 26)}
              <span>${s === "circle" ? "Cercle" : s === "pentagon" ? "Pentagone" : "Hexagone"}</span>
            </button>`
          )
          .join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="label">Palette de couleurs</div>
      <div class="theme-options">
        ${[
          ["aurora", "#ff9f1c", "#a78bfa", "#2dd4bf"],
          ["sunset", "#fb5eae", "#7c83fd", "#3ddc97"],
          ["neon", "#ff2ea6", "#7cf7ff", "#c6ff3d"],
        ]
          .map(
            ([key, a, b, c]) => `<button class="opt-btn ${settings.theme === key ? "active" : ""}" data-theme="${key}">
              <div class="theme-swatch"><i style="background:${a}"></i><i style="background:${b}"></i><i style="background:${c}"></i></div>
              <span>${key[0].toUpperCase() + key.slice(1)}</span>
            </button>`
          )
          .join("")}
      </div>
    </div>
    <div class="setting-block">
      <div class="label">Magasin suivi</div>
      <button class="card" style="width:100%;text-align:left;border:none;" data-change-store>
        <strong>${data.currentStoreName || ""}</strong>
        <div style="color:var(--text-dim);font-size:12.5px;margin-top:2px;">Changer de magasin</div>
      </button>
    </div>
    <button class="danger-btn" data-reset>Reinitialiser l'affichage des recompenses</button>
    <p class="about-text-sm">Remet a zero, sur cet appareil, les trophees deja "recuperes" a l'ecran pour ce magasin (ils reapparaitront a recuperer s'ils sont toujours merites).</p>
    ${data.isAdmin ? `
    <div class="setting-block">
      <div class="label">Date de depart des trophees (tous magasins)</div>
      <div class="card admin-cutoff-card">
        ${data.trophy_start_date
          ? `<strong>${data.trophy_start_date.split("-").reverse().join("/")}</strong><div class="about-text-sm">Tout ce qui precede cette date ne compte pour aucun trophee.</div>`
          : `<strong>Aucune coupure</strong><div class="about-text-sm">Tout l'historique compte pour les trophees.</div>`}
        <p class="about-text-sm" style="margin-top:10px;">Se change avec <code>Reinitialiser_trophees.bat</code> a la racine du projet (pas depuis cette page : l'appli est un site statique, sans acces en ecriture au serveur).</p>
      </div>
    </div>` : ""}
    <p class="about-text">Les donnees viennent de la compilation hebdomadaire du groupe (avis Google, Lyleoo, OOMADE) et sont republiees chaque semaine. Reglages sauvegardes sur cet appareil uniquement.</p>
  `;
  root.appendChild(wrap);

  wrap.querySelectorAll("[data-shape]").forEach((b) =>
    b.addEventListener("click", () => cb.setShape(b.dataset.shape))
  );
  wrap.querySelectorAll("[data-theme]").forEach((b) =>
    b.addEventListener("click", () => cb.setTheme(b.dataset.theme))
  );
  wrap.querySelector("[data-change-store]").addEventListener("click", cb.changeStore);
  wrap.querySelector("[data-save]").addEventListener("click", cb.save);
  wrap.querySelector("[data-reset]").addEventListener("click", () => {
    if (confirm(`Reinitialiser les trophees de ${data.currentStoreName || "ce magasin"} ? Les trophees deja obtenus reapparaitront comme nouveaux a recuperer.`)) {
      cb.resetBadges();
    }
  });
}
