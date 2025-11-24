param (
    [string] $Branch = 'master'
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param ([string] $Message)
    Write-Host $Message
}

function Ensure-GitRepo {
    git rev-parse --is-inside-work-tree *> $null 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw 'This script must be run from inside a git repository.'
    }
}

Ensure-GitRepo

if (-not (git show-ref --quiet "refs/heads/$Branch")) {
    if ($LASTEXITCODE -ne 0) {
        throw "Local branch '$Branch' does not exist. Fetch or create it first."
    }
}

$currentBranch = git rev-parse --abbrev-ref HEAD

$status = git status --porcelain
if ($status) {
    Write-Info '[WARN] Working tree is dirty. Commit or stash before checking master.'
}

Write-Info "Fetching origin/$Branch..."
git fetch origin $Branch | Out-Null

$localSha = git rev-parse $Branch
$remoteSha = git rev-parse "origin/$Branch"

if ($localSha -eq $remoteSha) {
    Write-Info "Local $Branch matches origin/$Branch."
} else {
    Write-Info "Local $Branch is out of sync with origin/$Branch."
    Write-Info 'Commits missing locally:'
    git --no-pager log --oneline "$Branch..origin/$Branch"
    Write-Info ''
    Write-Info 'Commits not pushed:'
    git --no-pager log --oneline "origin/$Branch..$Branch"
    Write-Info ''
    Write-Info 'Action required: rebase/merge origin/$Branch before merging.'
}

if ($currentBranch -ne $Branch) {
    Write-Info ''
    Write-Info "Comparing current branch '$currentBranch' with '$Branch'..."
    $behind = git rev-list --count "$currentBranch..$Branch"
    $ahead = git rev-list --count "$Branch..$currentBranch"
    Write-Info "  - $currentBranch is $ahead commit(s) ahead of $Branch"
    Write-Info "  - $currentBranch is $behind commit(s) behind $Branch"
    if ([int]$behind -gt 0) {
        Write-Info "  Rebase or merge $Branch into $currentBranch before opening the PR."
    }
}

Write-Info ''
Write-Info 'Done.'
