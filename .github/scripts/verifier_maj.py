"""Alerte si les donnees de l'appli n'ont pas ete republiees ce matin.

Lance chaque jour par .github/workflows/verifier-maj.yml, apres l'heure de la
publication quotidienne (8h00 sur le PC). Echoue (donc GitHub envoie un e-mail
au proprietaire du depot) quand data/data.json est trop ancien.
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

SEUIL_HEURES = 5          # la publication de 8h00 doit dater de moins de 5 h
try:
    from zoneinfo import ZoneInfo
    FUSEAU = ZoneInfo("Europe/Paris")
except Exception:          # poste sans base de fuseaux (essai local sous Windows)
    FUSEAU = timezone(timedelta(hours=1))

data = json.loads(Path("data/data.json").read_text(encoding="utf-8"))
brut = data.get("generated_at")
if not brut:
    print("::error::data/data.json n'a pas de date de generation.")
    sys.exit(1)

genere = datetime.fromisoformat(brut).replace(tzinfo=FUSEAU)   # heure locale du PC
age = (datetime.now(FUSEAU) - genere).total_seconds() / 3600
print(f"Derniere publication : {genere:%d/%m/%Y %H:%M} (il y a {age:.1f} h)")

if age > SEUIL_HEURES:
    print(f"::error::Mise a jour quotidienne manquante : les donnees datent du "
          f"{genere:%d/%m/%Y a %H:%M} ({age / 24:.1f} jour(s)). "
          f"Le PC est peut-etre eteint ou en attente de connexion : ouvrez la session "
          f"puis lancez Tout_actualiser_et_publier.bat.")
    sys.exit(1)
print("OK : les donnees ont ete republiees ce matin.")
