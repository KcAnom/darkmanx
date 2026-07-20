# darkman-x statusline segment (Windows port). Prints [DARKMAN-X] style
# badge from the active-mode flag; empty output if off/missing.

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$flagFile = Join-Path $configDir '.darkman-x-active'
$suffixFile = Join-Path $configDir '.darkman-x-statusline-suffix'

if (-not (Test-Path $flagFile)) { exit 0 }

$mode = (Get-Content $flagFile -Raw -ErrorAction SilentlyContinue)
if ($null -eq $mode) { exit 0 }
$mode = $mode.Trim()
if ([string]::IsNullOrEmpty($mode) -or $mode -eq 'off') { exit 0 }

if ($mode -eq 'full') {
    $badge = '[DARKMAN-X]'
} else {
    $badge = "[DARKMAN-X:$($mode.ToUpper())]"
}

$suffix = ''
$savingsEnv = $env:DARKMANX_STATUSLINE_SAVINGS
if ($savingsEnv -ne '0' -and (Test-Path $suffixFile)) {
    $suffix = (Get-Content $suffixFile -Raw -ErrorAction SilentlyContinue)
    if ($null -eq $suffix) { $suffix = '' }
}

Write-Host -NoNewline "$badge$suffix"
