# Suivi & Trophees

Appli web (statique, hebergee sur GitHub Pages) qui transforme le suivi
quotidien du groupe (avis Google, examens de vue Lyleoo, impressions 3D)
en tableau de bord ludique : anneaux de progression, score de la semaine,
et une collection de trophees a debloquer. Les objectifs restent
hebdomadaires (on repart a zero chaque semaine) ; seule la frequence des
releves a change, pour voir l'avancee se mettre a jour plus souvent.

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

Pour automatiser completement, double-cliquez
**`Installer_publication_quotidienne.bat`** : il installe une tache Windows
qui publie chaque jour a 9h00, quinze minutes apres la tache "Compilation
base magasins" (8h45). Le tout premier `git push` demandera une
authentification GitHub dans le navigateur (Git Credential Manager s'en
souvient ensuite).

## Personnaliser

- **Forme des anneaux et palette de couleurs** : reglables directement dans
  l'appli (page Reglages), par appareil.
- **Objectifs par magasin** : toujours dans `objectifs_magasins.csv`
  (dossier Suivi Groupe), comme avant — rien n'a change de ce cote.
- **Ajouter un trophee** : `js/badges.js` contient toutes les definitions,
  sous forme de liste. Un badge a tiers (bronze/argent/or...) ou un badge
  unique se rajoute en quelques lignes, sans toucher au reste de l'appli.

## Developper / tester en local

Le plus simple : double-cliquez sur `Tester_en_local.bat`, qui lance le
serveur et ouvre le navigateur automatiquement.

Un simple double-clic sur `index.html` ne fonctionne pas (le navigateur
bloque la lecture de `data.json` en local par securite). A la main, depuis
ce dossier :

```
py -3 -m http.server 8934
```

puis ouvrez `http://localhost:8934`. Evitez le port 8080 : c'est celui que
Pentaho occupe deja sur ce poste.

## Si le dossier "Suivi Groupe" est deplace

`scripts/exporter_donnees.py` le retrouve tout seul a proximite (meme
logique que `compiler_base.py`). S'il est vraiment ailleurs, creez
`scripts/chemins.json` :

```json
{ "SuiviGroupe": "D:\\ailleurs\\Suivi Groupe" }
```
