# Met a jour data/data.json depuis la base du groupe, puis publie sur GitHub
# (GitHub Pages republie automatiquement apres le push).
# A lancer apres la compilation hebdomadaire (Compiler_la_base.bat), ou double-cliquer
# Publier_app.bat qui appelle ce script.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Log($msg) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $msg"
}

# 1. Recompile la base source si on la retrouve a cote (facultatif : elle a
#    peut-etre deja tourne via sa propre tache planifiee du lundi matin).
$candidats = @(
    (Join-Path (Split-Path $PSScriptRoot -Parent) "APP SANTE 2.0\Suivi Groupe\compiler_base.py"),
    (Join-Path $env:USERPROFILE "Desktop\APP SANTE 2.0\Suivi Groupe\compiler_base.py")
)
$compilateur = $candidats | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($compilateur) {
    Log "Recompilation de la base source ($compilateur)"
    try {
        py -3 $compilateur
    } catch {
        Log "ATTENTION : la recompilation a echoue (Excel ouvert ?). On continue avec la derniere base disponible."
    }
} else {
    Log "compiler_base.py introuvable a cote : on utilise 'Base suivi magasins.xlsx' telle quelle."
}

# 2. Exporte data/data.json
Log "Export des donnees de l'app"
py -3 (Join-Path $PSScriptRoot "scripts\exporter_donnees.py")
if ($LASTEXITCODE -ne 0) {
    Log "Export en echec (code $LASTEXITCODE) : publication annulee."
    exit 1
}

# 3. Publie sur GitHub si quelque chose a change
git add data/data.json
$diff = git diff --cached --name-only
if (-not $diff) {
    Log "Aucun changement de donnees depuis la derniere publication."
    exit 0
}

git commit -m "Mise a jour hebdomadaire des donnees" | Out-Null
Log "Publication sur GitHub..."
git push
Log "Publie. La page se met a jour automatiquement en quelques dizaines de secondes."
