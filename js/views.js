import { ringClusterSVG, miniRingSVG, badgeShapeSVG } from "./shapes.js";
import { icon } from "./icons.js";
import { buildBadges, bestCurrentStreaks } from "./badges.js";

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
    <div class="ob-center">
      <div class="ob-brand">Lachal 2.0</div>
      <p class="sub">Choisissez votre magasin : cet appareil s'en souviendra.</p>
      <select class="ob-select" id="ob-select">
        <option value="" disabled selected>Choisir un magasin</option>
        ${sorted.map((s) => `<option value="${s.code}">${s.name} — ${s.ville}</option>`).join("")}
      </select>
      <button class="ob-validate" id="ob-validate" disabled>Valider</button>
    </div>
  `;
  root.appendChild(wrap);

  const select = wrap.querySelector("#ob-select");
  const validate = wrap.querySelector("#ob-validate");
  select.addEventListener("change", () => {
    validate.disabled = !select.value;
  });
  validate.addEventListener("click", () => {
    if (select.value) onPick(select.value);
  });
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
  }));

  const hero = document.createElement("div");
  hero.className = "hero";
  hero.innerHTML = `
    <div class="ring-wrap">
      ${ringClusterSVG(230, rings, settings.shape)}
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

  const badges = buildBadges(model);
  const unlocked = badges.filter((b) => b.unlocked);
  const preview = (unlocked.length ? unlocked.slice(-4).reverse() : badges.slice(0, 4));

  const trophySection = document.createElement("div");
  trophySection.innerHTML = `
    <div class="section-title">Trophees</div>
    <div class="badges-preview">
      ${preview
        .map(
          (b) => `<div class="badge-mini">
            <div class="badge-icon-overlay">${badgeShapeSVG(settings.shape, b.color, !b.unlocked, 52)}${icon(b.icon, 18)}</div>
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
      ${relevant
        .slice(-14)
        .map((w) => {
          const wm = w.metrics[m.key];
          const p = wm?.pct;
          let h, color;
          if (p === null || p === undefined) {
            h = 3;
            color = "var(--track)";
          } else {
            h = Math.max(6, Math.min(52, (Math.min(p, 150) / 150) * 52));
            color = wm.status === "gold" ? "var(--gold)" : wm.status === "miss" ? "var(--danger)" : `var(${m.colorVar})`;
          }
          return `<div class="bar" style="height:${h}px;background:${color}" title="${weekLabel(w.semaine)}"></div>`;
        })
        .join("")}
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
  const badges = buildBadges(model);
  const order = ["Combo", "Series", "Records", "Paliers"];
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
                <div class="badge-icon-overlay">${badgeShapeSVG(settings.shape, b.color, !b.unlocked, 56)}${icon(b.icon, 20)}</div>
                <div class="b-name">${b.name}</div>
                <div class="b-desc">${b.unlocked ? b.descUnlocked : b.descLocked}</div>
                ${b.progress && !b.unlocked ? `<div class="b-progress">${b.progress}</div>` : ""}
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
}
