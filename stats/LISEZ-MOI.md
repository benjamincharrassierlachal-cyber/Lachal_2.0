# Lachal Stats

Appli de statistiques de vente par magasin et par collaborateur, avec curseur
de santé. Même style que « Suivi & Trophées » ; vit dans le même dépôt, dans
`stats/`, pour pouvoir être fusionnée ensuite avec l'autre appli.

## Mise à jour (les 5 et 20 du mois)

1. Déposer le nouvel export dans `C:\APP SANTE 2.0 stat` (nom : `Export_Appli_AAAA-MM-JJ.xlsx`).
   Garder les anciens fichiers : chacun devient un point des courbes d'évolution.
2. Double-cliquer **`Publier_stats.bat`** (à la racine de l'appli). Il construit les données chiffrées puis publie.

## Confidentialité

Le dépôt GitHub est public : **rien n'est jamais publié en clair**.
`stats/data/` ne contient que des fichiers chiffrés (AES-256-GCM, clé dérivée du code d'accès par PBKDF2).

| Accès | Ce qu'il ouvre |
|---|---|
| Mot de passe admin | tout le groupe, tous les magasins et collaborateurs |
| Code d'un magasin | ce magasin, ses collaborateurs et les moyennes du réseau (anonymes) |

Les codes sont dans `C:\APP SANTE 2.0 stat\acces_stats.csv` (à ouvrir avec Excel ou le Bloc-notes) : **hors du dépôt, à ne jamais y mettre**.
Ce fichier est LE fichier à modifier ; `acces_stats.json` n'est qu'un paramètre technique.
Le code n'est demandé qu'à la première connexion sur un appareil, puis mémorisé.

- **Changer un code** : modifier la valeur dans `acces_stats.csv` (le libellé, lui, ne change pas), relancer `Publier_stats.bat`. Les appareils concernés redemandent le code (c'est aussi la façon de « déconnecter » tous les appareils).
- Les codes sont pris **tels quels** : majuscules, minuscules et symboles comptent.
- **Un seul mot de passe admin pour les deux applis** : la ligne ADMIN de `acces_stats.csv`. La construction en tire une empreinte lente et salée (`data/admin_check.json`) que « Suivi & Trophées » utilise pour vérifier le même mot de passe, sans qu'il soit écrit nulle part en clair. Changer le mot de passe = modifier cette ligne puis relancer `Publier_stats.bat`.
- **Règles** : un code ADMIN trop court (< 8 caractères) ou l'ancien mot de passe de « Suivi & Trophées » (devenu public dans l'historique GitHub) est refusé. Les fichiers chiffrés étant publics, plus un code est long, mieux c'est (12 caractères ou plus).
- **Verrouillage du magasin** : après la première connexion d'un magasin sur un appareil (« Mémoriser » coché), l'appareil lui est réservé : plus de liste de magasins, plus de bouton pour en changer ni pour se déconnecter. Seul l'admin peut passer sur un autre magasin, ou déverrouiller l'appareil dans Réglages.
- Un code **par magasin** reste la vraie barrière technique. Si plusieurs magasins partagent le même code, le verrouillage empêche d'aller voir un autre magasin dans l'appli, mais pas techniquement.
- Les fichiers Excel ne sont jamais publiés (ils restent dans `C:\APP SANTE 2.0 stat`).

## Curseur de santé

Chaque entité est comparée à son instance supérieure (collaborateur → son magasin, magasin → tous les magasins ;
Optic 2000 → Groupe Optic 2000, car ses définitions de taux diffèrent). **100 = la référence.**
Quatre piliers, à poids égal : Croissance du CA vs N-1, Transitions, Valeur (prix moyens), Eyezen.
Toucher un pilier sur l'accueil ouvre le détail de sa note, indicateur par indicateur. La page Chiffres présente tous les indicateurs en graphiques (jauges, donuts, barres N-1 / N, podium du mix produit…).
Zones : Fragile < 85 · À surveiller 85-97 · Dans la cible 97-108 · En forme 108-120 · Excellent ≥ 120.
Un collaborateur n'a de score qu'à partir de 30 ventes et 15 000 € de CA.

Tout se règle dans **`kpis.json`** (libellés, formats, sens bon/mauvais, piliers, seuils, collaborateurs exclus) sans toucher au code.
Les libellés sont une interprétation des noms de colonnes de l'export : à corriger là si besoin.

## Fichiers

- `index.html`, `css/`, `js/` : l'appli (réutilise `../css/styles.css`, `../js/shapes.js`, `../js/icons.js`)
- `kpis.json` : catalogue des indicateurs et paramètres du score
- `scripts/build_stats.py` : lit l'Excel, calcule scores et classements, écrit `data/*.json` chiffrés
- `data/` : fichiers chiffrés + `manifest.json` (liste publique des magasins, sans chiffres)

## Pas encore fait

- Liste des appareils connectés (impossible sur un site statique sans service tiers ; possible avec un petit journal Google Sheet).
- Page d'accueil qui propose « Stats » ou « Suivi & Trophées » (fusion).
- Magasins Générale d'Optique : seul le CA comptable est dans l'export (pas de score).
