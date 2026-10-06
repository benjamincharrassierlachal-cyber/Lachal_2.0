// Dechiffrement des fichiers de donnees (AES-256-GCM, cle derivee du code
// d'acces par PBKDF2-SHA256), entierement dans le navigateur : le code ne
// quitte jamais l'appareil, seule la cle derivee est (eventuellement)
// memorisee pour ne pas redemander le code a chaque ouverture.

const enc = new TextEncoder();

function fromB64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

// Le code est pris tel quel (casse et symboles comptent, espaces de debut et
// de fin retires) : meme regle que le script de construction.
export function normaliserCode(code) {
  return String(code ?? "").trim();
}

export async function deriverCle(code, blob) {
  const base = await crypto.subtle.importKey("raw", enc.encode(normaliserCode(code)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromB64(blob.salt), iterations: blob.iter },
    base,
    256
  );
  return toB64(new Uint8Array(bits));
}

// Renvoie les donnees en clair, ou leve une erreur si la cle ne convient pas.
export async function dechiffrer(blob, cleB64) {
  const key = await crypto.subtle.importKey("raw", fromB64(cleB64), "AES-GCM", false, ["decrypt"]);
  const clair = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(blob.iv) }, key, fromB64(blob.ct));
  if (!blob.gz) return JSON.parse(new TextDecoder().decode(clair));
  const flux = new Blob([clair]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(flux).text());
}
