# Windows install notes

## PowerShell one-liner

```powershell
irm https://raw.githubusercontent.com/OWNER/darkman-x/main/install.ps1 | iex
```

If your execution policy blocks this, run PowerShell as your normal user (not elevated) and either:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
irm https://raw.githubusercontent.com/OWNER/darkman-x/main/install.ps1 | iex
```

or download `install.ps1` first and inspect it before running (recommended for any curl/irm-piped script).

## Node.js

Install Node >= 18 from https://nodejs.org, or via `winget install OpenJS.NodeJS.LTS`.

## WSL

The installer refuses to run a **Windows-installed** Node binary from inside WSL (path/line-ending mismatches cause broken installs). Install Node natively inside your WSL distro instead:

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/darkman-x/main/install.sh | bash
```
