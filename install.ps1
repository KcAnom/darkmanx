# darkman-x installer shim. Safe to run via:
#   irm https://raw.githubusercontent.com/KcAnom/darkmanx/main/install.ps1 | iex
# Logic lives in a function so it works without $PSCommandPath (piped execution).

function Install-DarkmanX {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )

    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Error "darkman-x: Node.js >= 18 is required. Install it from https://nodejs.org and re-run."
        return
    }

    $nodeMajor = [int]((node -p "process.versions.node.split('.')[0]").Trim())
    if ($nodeMajor -lt 18) {
        Write-Error "darkman-x: Node.js >= 18 is required (found $(node -v))."
        return
    }

    $localInstaller = Join-Path $PSScriptRoot "bin/install.js"
    if ($PSScriptRoot -and (Test-Path $localInstaller)) {
        node $localInstaller @Args
    } else {
        npx -y "github:KcAnom/darkmanx" @Args
    }
}

Install-DarkmanX @args
