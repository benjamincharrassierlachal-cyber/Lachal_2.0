// Page d'accueil : une seule connexion (code magasin ou admin), puis le choix
// entre "Suivi & Trophees" et "Stats".

import { chargerManifest, verifierSession, connecter, deconnecter, deverrouiller, magasinVerrouille } from "./auth.js";

const sub = document.getElementById("hub-sub");
const zoneAuth = document.getElementById("auth");
const zoneChoix = document.getElementById("choix");

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function afficher(zone) {
  zoneAuth.hidden = zone !== "auth";
  zoneChoix.hidden = zone !== "choix";
}

function message(titre, texte) {
  zoneAuth.hidden = true;
  zoneChoix.hidden = true;
  sub.textContent = "";
  document.querySelector(".hub").insertAdjacentHTML("beforeend", `<p class="hub-msg"><b>${esc(titre)}</b><br>${esc(texte)}</p>`);
}

// ---------------------------------------------------------- choix de l'appli
function afficherChoix(manifest, session) {
  const admin = session.role === "admin";
  const verrou = magasinVerrouille();
  const magasin = manifest.magasins.find((m) => m.code === session.code);
  sub.textContent = "Choisissez une application";
  document.getElementById("hub-user").innerHTML = admin
    ? `<span>🔒 <b>Espace admin</b></span><button id="hub-logout">Se déconnecter</button>${verrou ? `<button id="hub-unlock">Déverrouiller cet appareil</button>` : ""}`
    : `<span>🔒 <b>${esc(magasin ? magasin.nom : "Magasin")}</b></span>`;
  document.getElementById("hub-logout")?.addEventListener("click", () => { deconnecter(); location.reload(); });
  document.getElementById("hub-unlock")?.addEventListener("click", () => { deverrouiller(); deconnecter(); location.reload(); });
  afficher("choix");
}

// ----------------------------------------------------------------- connexion
function afficherLogin(manifest, erreur) {
  const verrou = magasinVerrouille();
  const locked = verrou ? manifest.magasins.find((m) => m.code === verrou) : null;
  let modeAdmin = false;
  const tri = manifest.magasins.slice().sort((a, b) => a.nom.localeCompare(b.nom));
  sub.textContent = locked ? "Saisissez votre code d'accès" : "Choisissez votre magasin puis saisissez votre code d'accès";
  zoneAuth.innerHTML = `
    <select class="ob-select" id="lg-select" ${locked ? "hidden" : ""}>
      <option value="" disabled selected>Choisir un magasin</option>
      ${tri.map((m) => `<option value="${esc(m.code)}">${esc(m.nom)}${m.ville ? " — " + esc(m.ville) : ""}</option>`).join("")}
      <option value="__admin">🔒 Espace admin</option>
    </select>
    <div class="hub-lockbox" id="lg-lockbox" ${locked ? "" : "hidden"}><span id="lg-lockname"></span><small id="lg-locksub"></small></div>
    <div class="hub-pwd">
      <input class="ob-select" id="lg-code" type="password" placeholder="Code d'accès" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button type="button" class="hub-eye" id="lg-eye" aria-label="Afficher le code">👁</button>
    </div>
    <label class="hub-check"><input type="checkbox" id="lg-remember" checked /> Mémoriser cet appareil</label>
    <p class="ob-error" id="lg-error" ${erreur ? "" : "hidden"}>${esc(erreur || "")}</p>
    <button class="ob-validate" id="lg-go" disabled>Entrer</button>
    ${locked ? `<button class="ob-back-link" id="lg-toggle"></button>` : ""}
    <p class="hub-msg" style="margin-top:18px;font-size:12px">Le code n'est demandé qu'à la première connexion sur cet appareil.</p>`;
  afficher("auth");

  const select = zoneAuth.querySelector("#lg-select");
  const code = zoneAuth.querySelector("#lg-code");
  const go = zoneAuth.querySelector("#lg-go");
  const err = zoneAuth.querySelector("#lg-error");
  const toggle = zoneAuth.querySelector("#lg-toggle");
  const cible = () => (locked ? (modeAdmin ? "__admin" : locked.code) : select.value);
  const maj = () => (go.disabled = !cible() || !code.value.trim());
  const dessiner = () => {
    if (!locked) return;
    zoneAuth.querySelector("#lg-lockname").textContent = modeAdmin ? "🔒 Espace admin" : `🔒 ${locked.nom}`;
    zoneAuth.querySelector("#lg-locksub").textContent = modeAdmin ? "Accès administrateur" : "Magasin de cet appareil";
    toggle.textContent = modeAdmin ? "← Revenir à mon magasin" : "Accès administrateur";
    maj();
  };
  toggle?.addEventListener("click", () => { modeAdmin = !modeAdmin; err.hidden = true; code.value = ""; dessiner(); });
  dessiner();
  select.addEventListener("change", maj);
  code.addEventListener("input", maj);
  zoneAuth.querySelector("#lg-eye").addEventListener("click", () => { code.type = code.type === "password" ? "text" : "password"; });

  const valider = async () => {
    if (go.disabled) return;
    go.disabled = true;
    go.textContent = "Vérification…";
    err.hidden = true;
    const admin = cible() === "__admin";
    const res = await connecter(manifest, {
      role: admin ? "admin" : "magasin", code: admin ? null : cible(),
      secret: code.value, remember: zoneAuth.querySelector("#lg-remember").checked,
    });
    if (res.ok) {
      location.reload(); // revient sur l'accueil, cette fois connecte
      return;
    }
    err.textContent = res.msg;
    err.hidden = false;
    code.value = "";
    code.focus();
    go.textContent = "Entrer";
    maj();
  };
  go.addEventListener("click", valider);
  code.addEventListener("keydown", (e) => { if (e.key === "Enter") valider(); });
  if (locked) code.focus();
}

// --------------------------------------------------------------------- demarrage
(async function demarrer() {
  if (typeof DecompressionStream === "undefined" || !window.crypto || !crypto.subtle) {
    message("Navigateur trop ancien", "Cette appli a besoin d'un navigateur récent (Safari 16.4 ou plus, Chrome, Edge) et d'une connexion sécurisée (https).");
    return;
  }
  let manifest;
  try {
    manifest = await chargerManifest();
  } catch (e) {
    message("Données indisponibles", e.message);
    return;
  }
  const session = await verifierSession(manifest);
  if (session) afficherChoix(manifest, session);
  else afficherLogin(manifest);
})();
