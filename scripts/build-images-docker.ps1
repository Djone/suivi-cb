[CmdletBinding()]
param(
    [ValidateSet('linux/amd64', 'linux/arm64')]
    [string]$TargetPlatform = 'linux/amd64'
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = Split-Path -Parent $PSScriptRoot
$ReleaseDir = Join-Path $RepositoryRoot '.cache/releases/2.2.0-rc2'
$Rc2Archive = Join-Path $ReleaseDir 'suivi-cb-preprod-2.2.0-rc2.tar'

function Invoke-DockerChecked {
    param([string[]]$CommandArgs)
    & docker @CommandArgs
    if ($LASTEXITCODE -ne 0) {
        throw "Commande Docker en echec (code $LASTEXITCODE) : docker $($CommandArgs -join ' ')"
    }
}

Push-Location -LiteralPath $RepositoryRoot
try {
    if (Test-Path -LiteralPath $Rc2Archive) {
        throw "Archive rc2 deja presente : $Rc2Archive. Ne pas ecraser une candidate existante."
    }
    Get-Command docker -ErrorAction Stop | Out-Null
    Invoke-DockerChecked -CommandArgs @('version', '--format', '{{.Server.Os}}')
    New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
    Write-Host "Depot : $RepositoryRoot"
    Write-Host "Plateforme cible : $TargetPlatform"
    Invoke-DockerChecked -CommandArgs @('build', '--platform', $TargetPlatform, '-f', 'Dockerfile.backend', '-t', 'suivi-cb-preprod-backend:2.2.0-rc2', '.')
    Invoke-DockerChecked -CommandArgs @('build', '--platform', $TargetPlatform, '-f', 'Dockerfile.frontend', '-t', 'suivi-cb-preprod-frontend:2.2.0-rc2', '.')
    Invoke-DockerChecked -CommandArgs @('image', 'inspect', 'suivi-cb-preprod-backend:2.2.0-rc2', 'suivi-cb-preprod-frontend:2.2.0-rc2', '--format', '{{.Id}} {{.Os}}/{{.Architecture}} {{json .RepoTags}}')
    Invoke-DockerChecked -CommandArgs @('save', '-o', $Rc2Archive, 'suivi-cb-preprod-backend:2.2.0-rc2', 'suivi-cb-preprod-frontend:2.2.0-rc2')
    Write-Host "Archive creee : $Rc2Archive"
    Write-Host 'Etape suivante : inspection de cette archive (section 4 de la checklist).'
}
finally {
    Pop-Location
}
