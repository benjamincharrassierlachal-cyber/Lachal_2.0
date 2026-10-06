# Construit les donnees CHIFFREES de l'appli Stats a partir du dernier export
# Excel (dossier "C:\APP SANTE 2.0 stat"), puis publie sur GitHub Pages.
# A lancer apres avoir depose un nouveau fichier Export_Appli_AAAA-MM-JJ.xlsx
# (les 5 et 20 du mois), ou double-cliquer Publier_stats.bat.
#
# Les fichiers Excel et les codes d'acces ne quittent JAMAIS le PC : seuls les
# fichiers chiffres de stats\data et le code de l'appli sont envoyes.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Log($msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg"
}

Log "Construction des donnees chiffrees"
py -3 (Join-Path $PSScriptRoot "stats\scripts\build_stats.py")
if ($LASTEXITCODE -ne 0) {
    Log "Construction en echec (code $LASTEXITCODE) : publication annulee."
    exit 1
}

git add stats
$diff = git diff --cached --name-only -- stats
if (-not $diff) {
    Log "Aucun changement dans les statistiques."
    exit 0
}

git commit -m "Mise a jour des statistiques" | Out-Null
Log "Publication sur GitHub..."
git push
Log "Publie. L'appli Stats se met a jour automatiquement en quelques dizaines de secondes."
