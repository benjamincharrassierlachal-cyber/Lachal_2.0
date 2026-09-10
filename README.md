# Suivi & Trophees

Appli web (statique, hebergee sur GitHub Pages) qui transforme le suivi
hebdomadaire du groupe (avis Google, examens de vue Lyleoo, impressions 3D)
en tableau de bord ludique : anneaux de progression, score de la semaine,
et une collection de trophees a debloquer.

Fonctionne sur PC, tablette et smartphone (simple page web, ajoutable a
l'ecran d'accueil).

## Comment ca marche

```
Suivi Groupe (compiler_base.py, deja existant)
        -> Base suivi magasins.xlsx
                -> scripts/exporter_donnees.py
                        -> data/data.json   (le seul fichier que lit l'appli)
                                -> GitHub Pages
```

`data/data.json` est un instantane en lecture seule : il ne contient rien de
plus que ce que `Base suivi magasins.xlsx` et `objectifs_magasins.csv`
contiennent deja. L'appli ne fait que le mettre en forme dans le navigateur
(anneaux, badges, historiques) : aucun calcul metier n'est refait ailleurs.

## Mettre a jour les donnees publiees

Double-cliquez **`Publier_app.bat`** apres une compilation (ou laissez-le
tourner : il recompile la base source lui-meme s'il la retrouve a cote).
Il exporte `data/data.json` et le pousse sur GitHub — la page publique se
met a jour automatiquement en quelques dizaines de secondes.

Pour automatiser completement (comme la tache "Compilation base magasins"
du lundi matin), planifiez `Publier_app.ps1` une quinzaine de minutes apres
cette tache-la. Le tout premier `git push` demandera une authentification
GitHub dans le navigateur (Git Credential Manager s'en souvient ensuite).

## Personnaliser

- **Forme des anneaux et palette de couleurs** : reglables directement dans
  l'appli (page Reglages), par appareil.
- **Objectifs par magasin** : toujours dans `objectifs_magasins.csv`
  (dossier Suivi Groupe), comme avant — rien n'a change de ce cote.
- **Ajouter un trophee** : `js/badges.js` contient toutes les definitions,
  sous forme de liste. Un badge a tiers (bronze/argent/or...) ou un badge
  unique se rajoute en quelques lignes, sans toucher au reste de l'appli.

## Developper / tester en local

Un simple double-clic sur `index.html` ne fonctionne pas (le navigateur
bloque la lecture de `data.json` en local par securite). Lancez un petit
serveur depuis ce dossier :

```
py -3 -m http.server 8080
```

puis ouvrez `http://localhost:8080`.

## Si le dossier "Suivi Groupe" est deplace

`scripts/exporter_donnees.py` le retrouve tout seul a proximite (meme
logique que `compiler_base.py`). S'il est vraiment ailleurs, creez
`scripts/chemins.json` :

```json
{ "SuiviGroupe": "D:\\ailleurs\\Suivi Groupe" }
```
