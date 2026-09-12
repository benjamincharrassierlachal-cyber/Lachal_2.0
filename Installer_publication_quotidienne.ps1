# Cree (ou remplace) la tache Windows qui publie l'app chaque jour.
#
# Deux declencheurs, comme les autres taches du groupe :
#   - chaque jour a 9h00 (15 min apres la compilation de la base a 8h45) ;
#   - a chaque ouverture de session, 20 minutes apres.
# Publier_app.ps1 est deja idempotent : s'il n'y a rien de nouveau a publier,
# il ne fait ni commit ni push. Aucun risque a le relancer plusieurs fois par
# jour, donc pas besoin de logique "si necessaire" ici.

$ErrorActionPreference = 'Stop'
$nomTache = 'Publication app trophees'
$runner   = Join-Path $PSScriptRoot 'Publier_app.ps1'

if (-not (Test-Path -LiteralPath $runner)) {
    Write-Host "Fichier introuvable : $runner" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour fermer"; exit 1
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $PSScriptRoot `
    -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $runner)

$quotidien = New-ScheduledTaskTrigger -Daily -At 9:00am
$ouverture = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$ouverture.Delay = 'PT20M'   # 20 minutes apres l'ouverture de session

$reglages = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
    -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)

$identite = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nomTache -Action $action -Trigger @($quotidien, $ouverture) `
    -Settings $reglages -Principal $identite `
    -Description 'Recompile, exporte et publie l app Suivi & Trophees sur GitHub Pages.' -Force | Out-Null

$infos = Get-ScheduledTaskInfo -TaskName $nomTache
Write-Host ""
Write-Host "Tache installee : $nomTache" -ForegroundColor Green
Write-Host "  - chaque jour a 9h00, apres la compilation de la base (8h45)"
Write-Host "  - et 20 min apres chaque ouverture de session"
Write-Host "Prochaine execution planifiee : $($infos.NextRunTime)"
Write-Host ""
Write-Host "Le tout premier push demandera une authentification GitHub dans le"
Write-Host "navigateur (Git Credential Manager s'en souvient ensuite)."
Write-Host ""
Write-Host "Pour supprimer la tache plus tard :"
Write-Host "   Unregister-ScheduledTask -TaskName '$nomTache' -Confirm:`$false"
Write-Host ""
$test = Read-Host "Publier tout de suite ? (O/N)"
if ($test -match '^[OoYy]') {
    Start-ScheduledTask -TaskName $nomTache
    Write-Host "Lance en arriere-plan (quelques secondes)."
}
Read-Host "Appuyez sur Entree pour fermer"
