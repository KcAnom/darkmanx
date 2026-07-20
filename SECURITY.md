# Security Policy

## Reporting a vulnerability

If you find a security issue in darkman-x, please do **not** open a public issue. Instead, email the maintainers (see repository contact info) or use GitHub's private vulnerability reporting on this repo. Include:

- A description of the issue and its impact
- Steps to reproduce
- Affected version/commit

We'll acknowledge reports as soon as possible and work with you on a fix and disclosure timeline.

## Scope and posture

darkman-x is designed to have almost no attack surface by default:

- **No SaaS backend, no accounts, no telemetry, no phone-home.** Everything runs locally.
- Installer and hooks are pure Node stdlib — no third-party runtime dependencies to inherit vulnerabilities from.
- File writes (flags, config) go through symlink-safe atomic write helpers (`safeWriteFlag`) — see `src/hooks/darkman-x-config.js`.
- The optional MCP shrink proxy (`darkman-x-shrink`) only rewrites description-style text fields in JSON-RPC messages it passes through; it does not execute or evaluate message content.
- The optional compress tool (`darkman-x-compress`) backs up files outside the project tree before rewriting them, and refuses sensitive filenames/paths.
- Remote install scripts (`install.sh`/`install.ps1`, curl-piped hooks) are pinned to a release ref (`DARKMANX_REF`), not floating `main`, and hook downloads ship with checksums (`src/hooks/checksums.sha256`).

If you believe any of the above guarantees don't hold, that's a security bug — please report it.
