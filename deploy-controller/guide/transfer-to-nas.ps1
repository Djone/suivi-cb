# Run on the Windows PC. Passwords are requested only by OpenSSH.
$ErrorActionPreference = 'Stop'
$candidate = '__CANDIDATE__'
$runNumber = '__RUN__'
$expectedZip = '__ZIP_SHA__'
$destination = 'GodOfNasAugerie@192.168.1.113'
$remote = '/volume1/docker/suivi-cb-preprod/releases/' + $candidate
if ($expectedZip -notmatch '^[a-f0-9]{64}$') { throw 'Authenticated GitHub archive required. Use File Station for a manual import.' }
foreach ($command in @('ssh', 'scp', 'tar')) { Get-Command $command -ErrorAction Stop | Out-Null }
$kit = $PSScriptRoot
$zip = Join-Path (Split-Path $kit -Parent) ('candidate-' + $runNumber + '.zip')
if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedZip) { throw 'Candidate ZIP checksum mismatch' }
foreach ($line in Get-Content -LiteralPath (Join-Path $kit 'SHA256SUMS')) {
    if ($line -notmatch '^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$') { throw 'Invalid kit checksum entry' }
    $expected = $Matches[1]; $relative = $Matches[2]
    if ($relative -match '(^|/)\.\.(/|$)' -or $relative.StartsWith('/')) { throw 'Invalid kit path' }
    if ((Get-FileHash -LiteralPath (Join-Path $kit $relative) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw ('Kit checksum mismatch: ' + $relative) }
}
# Build a disposable transport archive from verified files only.
$transferId = [Guid]::NewGuid().ToString('N')
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$temporary = Join-Path $tempRoot ('suivi-cb-transfer-' + $transferId)
New-Item -ItemType Directory -Path $temporary -ErrorAction Stop | Out-Null
try {
    $candidateFolder = Join-Path $temporary ('candidate-' + $runNumber)
    New-Item -ItemType Directory -Path $candidateFolder | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($zip)
    try {
        if ($archive.Entries.Count -gt 80) { throw 'Too many archive entries' }
        $names = @{}; $total = 0L
        foreach ($entry in $archive.Entries) {
            $name = $entry.FullName
            if ($name -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$' -or $name -match '^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)' -or $names.ContainsKey($name)) { throw 'Unsafe archive name' }
            $names[$name] = $true; $total += $entry.Length
            if ($total -gt 2GB) { throw 'Archive too large' }
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path $candidateFolder $name))
        }
    } finally { $archive.Dispose() }
    $targetKit = Join-Path $temporary 'nas-kit'
    New-Item -ItemType Directory -Path $targetKit | Out-Null
    foreach ($line in Get-Content -LiteralPath (Join-Path $kit 'SHA256SUMS')) {
        $relative = $line.Substring(66)
        $target = Join-Path $targetKit $relative
        New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
        Copy-Item -LiteralPath (Join-Path $kit $relative) -Destination $target
    }
    Copy-Item -LiteralPath (Join-Path $kit 'SHA256SUMS') -Destination $targetKit
    $transport = Join-Path $temporary 'nas-transfer.tar.gz'
    & tar -czf $transport -C $temporary ('candidate-' + $runNumber) nas-kit
    if ($LASTEXITCODE -ne 0) { throw 'Transport archive creation failed' }
    $transportSha = (Get-FileHash -LiteralPath $transport -Algorithm SHA256).Hash.ToLowerInvariant()
    $reserve = 'set -eu; umask 077; mkdir ''{0}''; printf ''%s'' ''{1}'' > ''{0}/.transfer-id''' -f $remote, $transferId
    & ssh -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -p 1122 $destination $reserve
    if ($LASTEXITCODE -ne 0) { throw 'NAS directory creation failed. Existing directories are never overwritten.' }
    & scp -O -o StrictHostKeyChecking=yes -P 1122 $transport ($destination + ':' + $remote + '/nas-transfer.tar.gz')
    if ($LASTEXITCODE -ne 0) { throw 'Transfer failed. Keep the NAS folder for inspection.' }
    $verify = 'set -eu; cd ''{0}''; test "$(cat .transfer-id)" = ''{1}''; printf ''%s  %s\n'' ''{2}'' nas-transfer.tar.gz | sha256sum -c -; tar -xzf nas-transfer.tar.gz; (cd candidate-{3} && sha256sum -c SHA256SUMS); (cd nas-kit && sha256sum -c SHA256SUMS); rm nas-transfer.tar.gz .transfer-id; echo NAS_TRANSFER_OK' -f $remote, $transferId, $transportSha, $runNumber
    & ssh -o StrictHostKeyChecking=yes -o ConnectTimeout=10 -p 1122 $destination $verify
    if ($LASTEXITCODE -ne 0) { throw 'NAS verification failed. Do not deploy.' }
} finally {
    $resolved = [IO.Path]::GetFullPath($temporary)
    if ($resolved.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf) -eq ('suivi-cb-transfer-' + $transferId) -and -not ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
