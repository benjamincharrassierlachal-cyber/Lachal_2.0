# Fixe (ou efface) la date a partir de laquelle les trophees comptent, et
# republie. Les trophees restent calcules a partir de l'historique reel :
# tout ce qui precede la date choisie est simplement ignore pour eux (les
# chiffres/l'historique affiches aux magasins, eux, ne changent pas).
#
# S'applique a TOUS les magasins, sur tous les appareils, des la
# publication (contrairement au bouton "Reinitialiser l'affichage des
# recompenses" des Reglages, qui ne concerne qu'un magasin sur un appareil).

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Log($msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg"
}

$fichier = Join-Path $PSScriptRoot "scripts\trophees_depuis.txt"
$actuelle = if (Test-Path $fichier) { (Get-Content $fichier -Raw).Trim() } else { "" }

Write-Host ""
Write-Host "=== Reinitialisation des trophees ==="
if ($actuelle) {
    Write-Host "Date actuelle : $actuelle"
} else {
    Write-Host "Aucune coupure actuellement : tout l'historique compte."
}
Write-Host ""
Write-Host "Entrez la nouvelle date de depart (JJ/MM/AAAA), ou laissez vide pour"
Write-Host "annuler la coupure (tout l'historique recompte pour les trophees)."
$saisie = Read-Host "Date"

if ([string]::IsNullOrWhiteSpace($saisie)) {
    if (Test-Path $fichier) { Remove-Item $fichier -Force }
    Log "Coupure supprimee : tout l'historique recompte pour les trophees."
} else {
    $date = $null
    try {
        $date = [datetime]::ParseExact($saisie.Trim(), "dd/MM/yyyy", $null)
    } catch {
        Log "Date invalide (attendu JJ/MM/AAAA) : $saisie"
        exit 1
    }
    Set-Content -Path $fichier -Value $date.ToString("yyyy-MM-dd") -Encoding utf8 -NoNewline
    Log "Nouvelle date de depart : $($date.ToString('dd/MM/yyyy'))"
    Log "Les premiers trophees n'apparaitront qu'a partir de la semaine suivante."
}

# Recompile la base source si on la retrouve a cote (comme Publier_app.ps1)
$candidats = @(
    (Join-Path (Split-Path $PSScriptRoot -Parent) "Suivi Groupe\compiler_base.py"),
    (Join-Path (Split-Path $PSScriptRoot -Parent) "Suivi groupe\compiler_base.py"),
    (Join-Path $env:USERPROFILE "Desktop\APP SANTE 2.0\Suivi Groupe\compiler_base.py")
)
$compilateur = $candidats | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($compilateur) {
    Log "Recompilation de la base source"
    try { py -3 $compilateur } catch { Log "ATTENTION : recompilation echouee (Excel ouvert ?), on continue." }
}

Log "Export des donnees de l'app"
py -3 (Join-Path $PSScriptRoot "scripts\exporter_donnees.py")
if ($LASTEXITCODE -ne 0) {
    Log "Export en echec (code $LASTEXITCODE) : publication annulee."
    exit 1
}

git add data/data.json scripts/trophees_depuis.txt
$diff = git diff --cached --name-only
if (-not $diff) {
    Log "Rien a publier (aucun changement)."
    exit 0
}

git commit -m "Fixe la date de depart des trophees" | Out-Null
Log "Publication sur GitHub..."
git push
Log "Publie. Tous les appareils verront l'effet en quelques dizaines de secondes."
