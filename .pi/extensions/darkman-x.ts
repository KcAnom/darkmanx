/**
 * darkman-x — Pi project extension
 *
 * Session-start activation + /darkman-x mode switch + /darkman-x-voice toggle.
 * Mirrors Claude SessionStart / mode-tracker behavior without touching Claude config.
 *
 * Default voice model: s2.1-pro-free (last commit).
 * Default voice id: 552fdfe0e4f542c1bb381d1006c1ac9b
 *
 * Modes: off | lite | full | ultra | wenyan-lite | wenyan | wenyan-full | wenyan-ultra
 * One-shots (do not permanently displace prose mode): commit | review | compress
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// Guard: if both global (~/.pi/agent/extensions) and project (.pi/extensions)
// resolve to the same file, only the first factory runs.
const GLOBAL_ONCE_KEY = "__darkmanXPiExtensionLoaded";
const g = globalThis as typeof globalThis & { [GLOBAL_ONCE_KEY]?: boolean };

const VALID_MODES = new Set([
	"off",
	"lite",
	"full",
	"ultra",
	"wenyan-lite",
	"wenyan",
	"wenyan-full",
	"wenyan-ultra",
	"commit",
	"review",
	"compress",
]);

const INDEPENDENT = new Set(["commit", "review", "compress"]);

const DEFAULT_VOICE_ID = "552fdfe0e4f542c1bb381d1006c1ac9b";
const DEFAULT_VOICE_MODEL = "s2.1-pro-free";
const STATE_TYPE = "darkman-x-state";

const FALLBACK_RULES = [
	"Respond terse like Darkman X — short, hard, exact.",
	"Drop filler, hedging, and restated questions. Fragments are fine.",
	"Preserve code, commands, errors, and the user's own words byte-exact.",
	"Pattern: [thing] [action] [reason]. [next step].",
	"No invented abbreviations. No fake causal arrows used just to look compressed.",
	"Auto-clarity — write normally for: security warnings, irreversible confirmations, ambiguous multi-step requests, visible user confusion.",
	"Boundaries — always write normally: code, commit messages, PR descriptions.",
].join("\n");

type State = {
	mode: string;
	prevMode: string;
	voice: boolean;
	sfx: boolean;
};

function xdgConfigHome(): string {
	if (process.platform === "win32") {
		return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
	}
	return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

/**
 * Load Pi-dedicated secrets first, then root .env as fallback.
 * Non-destructive: never overwrites keys already set in process.env.
 * Never logs values. Silent-fail on missing/unreadable files.
 */
/**
 * Resolve the darkman-x repo root so the extension works from any cwd
 * (global install under ~/.pi/agent/extensions/ + project-local).
 */
function resolveDarkmanRoot(cwd?: string): string {
	const envRoot = process.env.DARKMANX_ROOT;
	if (envRoot && fs.existsSync(path.join(envRoot, "skills", "darkman-x", "SKILL.md"))) {
		return path.resolve(envRoot);
	}

	// Prefer realpath of this extension file → …/darkmanx/.pi/extensions/darkman-x.ts
	try {
		const here = fileURLToPath(import.meta.url);
		const real = fs.realpathSync(here);
		const fromExt = path.resolve(path.dirname(real), "..", "..");
		if (fs.existsSync(path.join(fromExt, "skills", "darkman-x", "SKILL.md"))) {
			return fromExt;
		}
	} catch {
		// import.meta may be unavailable in some loaders — fall through
	}

	const start = path.resolve(cwd || process.cwd());
	let dir = start;
	for (let i = 0; i < 64; i++) {
		if (fs.existsSync(path.join(dir, "skills", "darkman-x", "SKILL.md"))) return dir;
		if (
			path.basename(dir) === ".pi" &&
			fs.existsSync(path.join(dir, "skills", "darkman-x", "SKILL.md"))
		) {
			return path.dirname(dir);
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}

	// Last resort: known checkout path on this machine
	const fallback = path.join(os.homedir(), "darkmanx");
	if (fs.existsSync(path.join(fallback, "skills", "darkman-x", "SKILL.md"))) return fallback;

	return start;
}

function loadPiEnv(cwd: string, repoRoot: string): { loaded: string[] } {
	const loaded: string[] = [];
	const candidates = [
		path.join(repoRoot, ".pi", "darkman-x-pi.env"), // Pi-dedicated (always, even if cwd elsewhere)
		path.join(cwd, ".pi", "darkman-x-pi.env"),
		path.join(cwd, ".env"),
		path.join(repoRoot, ".env"),
		path.join(xdgConfigHome(), "darkman-x", ".env"),
	];
	const seen = new Set<string>();
	for (const file of candidates) {
		if (!file || seen.has(file)) continue;
		seen.add(file);
		try {
			if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink()) continue;
			const raw = fs.readFileSync(file, "utf8");
			for (const line of raw.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith("#")) continue;
				const eq = trimmed.indexOf("=");
				if (eq <= 0) continue;
				const key = trimmed.slice(0, eq).trim();
				let val = trimmed.slice(eq + 1).trim();
				if (
					(val.startsWith('"') && val.endsWith('"')) ||
					(val.startsWith("'") && val.endsWith("'"))
				) {
					val = val.slice(1, -1);
				}
				if (!key) continue;
				// Skip empty / known placeholders so a real key in root .env can still win.
				const placeholders = [
					"paste_your_fish_api_key_here",
					"your_key_here",
					"your_api_key",
					"changeme",
					"xxx",
				];
				if (!val || placeholders.includes(val.toLowerCase())) continue;
				if (process.env[key] === undefined || process.env[key] === "") {
					process.env[key] = val;
				}
			}
			loaded.push(file);
		} catch {
			// silent-fail
		}
	}
	return { loaded };
}

function hasUsableFishKey(): boolean {
	const k = (process.env.FISH_API_KEY || process.env.FISH_AUDIO_API_KEY || "").trim();
	if (!k) return false;
	const placeholders = [
		"paste_your_fish_api_key_here",
		"your_key_here",
		"your_api_key",
		"changeme",
		"xxx",
	];
	return !placeholders.includes(k.toLowerCase());
}

function darkmanConfigDir(): string {
	return path.join(xdgConfigHome(), "darkman-x");
}

function readJsonSafe(filePath: string): Record<string, unknown> | null {
	try {
		if (!fs.existsSync(filePath) || fs.lstatSync(filePath).isSymbolicLink()) return null;
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

function findRepoConfigPath(cwd: string): string | null {
	let dir = path.resolve(cwd);
	const candidates = [".darkman-x/config.json", ".darkman-x.json"];
	for (let i = 0; i < 64; i++) {
		for (const rel of candidates) {
			const candidate = path.join(dir, rel);
			try {
				if (fs.existsSync(candidate) && !fs.lstatSync(candidate).isSymbolicLink()) {
					return candidate;
				}
			} catch {
				// skip
			}
		}
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
}

function resolveDefaultMode(cwd: string): string {
	const envMode = process.env.DARKMANX_DEFAULT_MODE;
	if (envMode && VALID_MODES.has(envMode)) return envMode;

	const repoPath = findRepoConfigPath(cwd);
	if (repoPath) {
		const cfg = readJsonSafe(repoPath);
		const m = cfg && typeof cfg.defaultMode === "string" ? cfg.defaultMode : null;
		if (m && VALID_MODES.has(m)) return m;
	}

	const userCfg = readJsonSafe(path.join(darkmanConfigDir(), "config.json"));
	const um = userCfg && typeof userCfg.defaultMode === "string" ? userCfg.defaultMode : null;
	if (um && VALID_MODES.has(um)) return um;

	return "full";
}

function resolveVoiceDefault(): boolean {
	const env = process.env.DARKMANX_VOICE;
	if (env === "0" || env === "off" || env === "false") return false;
	if (env === "1" || env === "on" || env === "true") return true;

	// Prefer XDG flag (shared with CLI / non-Claude use)
	const flagPath = path.join(darkmanConfigDir(), ".darkman-x-voice");
	try {
		if (fs.existsSync(flagPath) && !fs.lstatSync(flagPath).isSymbolicLink()) {
			const raw = fs.readFileSync(flagPath, "utf8").trim().toLowerCase();
			if (raw === "on" || raw === "1" || raw === "true") return true;
			if (raw === "off" || raw === "0" || raw === "false") return false;
		}
	} catch {
		// ignore
	}

	const userCfg = readJsonSafe(path.join(darkmanConfigDir(), "config.json"));
	const voice = userCfg && (userCfg.voice as Record<string, unknown> | undefined);
	if (voice && typeof voice.enabled === "boolean") return voice.enabled;
	return false;
}

function resolveSfxDefault(): boolean {
	const env = process.env.DARKMANX_SFX;
	if (env === "0" || env === "off" || env === "false") return false;
	if (env === "1" || env === "on" || env === "true") return true;

	const flagPath = path.join(darkmanConfigDir(), ".darkman-x-sfx");
	try {
		if (fs.existsSync(flagPath) && !fs.lstatSync(flagPath).isSymbolicLink()) {
			const raw = fs.readFileSync(flagPath, "utf8").trim().toLowerCase();
			if (raw === "on" || raw === "1" || raw === "true") return true;
			if (raw === "off" || raw === "0" || raw === "false") return false;
		}
	} catch {
		// ignore
	}

	const userCfg = readJsonSafe(path.join(darkmanConfigDir(), "config.json"));
	const sfx = userCfg && (userCfg.sfx as Record<string, unknown> | undefined);
	if (sfx && typeof sfx.enabled === "boolean") return sfx.enabled;
	return false;
}

function skillCandidates(cwd: string, repoRoot: string): string[] {
	return [
		path.join(repoRoot, "skills", "darkman-x", "SKILL.md"),
		path.join(repoRoot, ".pi", "skills", "darkman-x", "SKILL.md"),
		path.join(repoRoot, "plugins", "darkman-x", "skills", "darkman-x", "SKILL.md"),
		path.join(cwd, "skills", "darkman-x", "SKILL.md"),
		path.join(cwd, ".pi", "skills", "darkman-x", "SKILL.md"),
	];
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

function filterIntensityTable(body: string, mode: string): string {
	const lines = body.split("\n");
	const out: string[] = [];
	let inTable = false;
	const aliases = new Set([mode]);
	if (mode === "wenyan") aliases.add("wenyan-full");
	if (mode === "wenyan-full") aliases.add("wenyan");

	for (const line of lines) {
		const isTableRow = /^\s*\|/.test(line);
		if (isTableRow) {
			if (!inTable) {
				inTable = true;
				out.push(line); // header
				continue;
			}
			// separator
			if (/^\s*\|\s*[-:| ]+\|\s*$/.test(line)) {
				out.push(line);
				continue;
			}
			const firstCell = line.split("|")[1]?.trim().toLowerCase() || "";
			const keep = [...aliases].some(
				(a) => firstCell === a || firstCell.startsWith(a + " ") || firstCell.includes("`" + a + "`"),
			);
			// Always keep default-marked row labels if they match
			if (keep || firstCell.includes("(default)") && aliases.has("full") && firstCell.includes("full")) {
				out.push(line);
			}
			continue;
		}
		if (inTable) inTable = false;
		out.push(line);
	}
	return out.join("\n");
}

function loadModeRules(cwd: string, repoRoot: string, mode: string): string {
	if (mode === "off") return "";

	for (const p of skillCandidates(cwd, repoRoot)) {
		try {
			if (!fs.existsSync(p)) continue;
			const raw = fs.readFileSync(p, "utf8");
			const body = stripFrontmatter(raw);
			const filtered = filterIntensityTable(body, mode);
			return filtered.trim() || FALLBACK_RULES;
		} catch {
			// try next
		}
	}
	return FALLBACK_RULES;
}

function voiceSettings(): { model: string; voiceId: string } {
	const userCfg = readJsonSafe(path.join(darkmanConfigDir(), "config.json"));
	const v = (userCfg && (userCfg.voice as Record<string, unknown>)) || {};
	return {
		model:
			process.env.DARKMANX_VOICE_MODEL ||
			(typeof v.model === "string" ? v.model : null) ||
			DEFAULT_VOICE_MODEL,
		voiceId:
			process.env.DARKMANX_VOICE_ID ||
			(typeof v.referenceId === "string" ? v.referenceId : null) ||
			(typeof v.voiceId === "string" ? v.voiceId : null) ||
			DEFAULT_VOICE_ID,
	};
}

function writeVoiceFlag(enabled: boolean): void {
	try {
		const dir = darkmanConfigDir();
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		const flagPath = path.join(dir, ".darkman-x-voice");
		if (fs.existsSync(flagPath) && fs.lstatSync(flagPath).isSymbolicLink()) return;
		fs.writeFileSync(flagPath, enabled ? "on\n" : "off\n", { mode: 0o600 });
	} catch {
		// silent-fail
	}
}

function writeSfxFlag(enabled: boolean): void {
	try {
		const dir = darkmanConfigDir();
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
		const flagPath = path.join(dir, ".darkman-x-sfx");
		if (fs.existsSync(flagPath) && fs.lstatSync(flagPath).isSymbolicLink()) return;
		fs.writeFileSync(flagPath, enabled ? "on\n" : "off\n", { mode: 0o600 });
	} catch {
		// silent-fail
	}
}

function speakPath(cwd: string, repoRoot: string): string | null {
	const candidates = [
		path.join(repoRoot, "src", "tools", "darkman-x-speak.js"),
		path.join(cwd, "src", "tools", "darkman-x-speak.js"),
		path.join(repoRoot, "bin", "darkman-x-speak.js"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

function trySpeak(cwd: string, repoRoot: string, text: string): void {
	const script = speakPath(cwd, repoRoot);
	if (!script) return;
	try {
		spawnSync(process.execPath, [script, "--quiet", "--", text], {
			cwd: repoRoot,
			stdio: "ignore",
			timeout: 30_000,
			env: process.env,
		});
	} catch {
		// silent-fail — never block session
	}
}

function sfxPath(cwd: string, repoRoot: string): string | null {
	const candidates = [
		path.join(repoRoot, "src", "tools", "darkman-x-sfx.js"),
		path.join(cwd, "src", "tools", "darkman-x-sfx.js"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

function trySfx(cwd: string, repoRoot: string, clip: string): void {
	const script = sfxPath(cwd, repoRoot);
	if (!script) return;
	try {
		spawnSync(process.execPath, [script, "--quiet", clip], {
			cwd: repoRoot,
			stdio: "ignore",
			timeout: 15_000,
			env: process.env,
		});
	} catch {
		// silent-fail — never block session
	}
}

function setStatus(ctx: ExtensionContext, state: State): void {
	if (state.mode === "off") {
		ctx.ui.setStatus("darkman-x", undefined);
		return;
	}
	const voiceBit = state.voice ? " +VOICE" : "";
	const sfxBit = state.sfx ? " +SFX" : "";
	ctx.ui.setStatus("darkman-x", `darkman-x:${state.mode}${voiceBit}${sfxBit}`);
}

function normalizeMode(raw: string): string | null {
	const m = raw.trim().toLowerCase();
	if (!m) return "full";
	// alias
	if (m === "wenyan-full") return "wenyan-full";
	if (m === "normal") return "off";
	if (VALID_MODES.has(m)) return m;
	return null;
}

export default function darkmanXExtension(pi: ExtensionAPI) {
	if (g[GLOBAL_ONCE_KEY]) {
		// Already registered (global + project both pointed here).
		return;
	}
	g[GLOBAL_ONCE_KEY] = true;

	const state: State = {
		mode: "full",
		prevMode: "full",
		voice: false,
		sfx: false,
	};
	let cwd = process.cwd();
	let repoRoot = resolveDarkmanRoot(cwd);
	let rulesCache = "";

	function refreshRules(): void {
		rulesCache = state.mode === "off" ? "" : loadModeRules(cwd, repoRoot, state.mode);
	}

	function applyMode(next: string, ctx: ExtensionContext, opts?: { silent?: boolean }): void {
		if (INDEPENDENT.has(next)) {
			// one-shot: stash last durable prose mode (never stash another one-shot)
			if (!INDEPENDENT.has(state.mode) && state.mode !== "off") {
				state.prevMode = state.mode;
			} else if (!state.prevMode || INDEPENDENT.has(state.prevMode)) {
				state.prevMode = "full";
			}
			state.mode = next;
		} else if (next === "off") {
			// keep prevMode as last prose intensity for a clean re-enable
			if (!INDEPENDENT.has(state.mode) && state.mode !== "off") {
				state.prevMode = state.mode;
			}
			state.mode = "off";
		} else {
			state.mode = next;
			state.prevMode = next;
		}
		refreshRules();
		setStatus(ctx, state);
		pi.appendEntry(STATE_TYPE, { ...state });
		if (!opts?.silent) {
			if (state.mode === "off") {
				ctx.ui.notify("darkman-x off. Normal voice.", "info");
			} else {
				const badge = `${state.voice ? " +VOICE" : ""}${state.sfx ? " +SFX" : ""}`;
				ctx.ui.notify(`darkman-x ${state.mode}${badge}`, "info");
			}
		}
	}

	function reconstructFromSession(ctx: ExtensionContext): void {
		try {
			for (const entry of ctx.sessionManager.getEntries()) {
				if (entry.type !== "custom" || entry.customType !== STATE_TYPE) continue;
				const data = entry.data as Partial<State> | undefined;
				if (!data) continue;
				if (typeof data.mode === "string" && VALID_MODES.has(data.mode)) {
					state.mode = data.mode;
				}
				if (typeof data.prevMode === "string") state.prevMode = data.prevMode;
				if (typeof data.voice === "boolean") state.voice = data.voice;
				if (typeof data.sfx === "boolean") state.sfx = data.sfx;
			}
		} catch {
			// silent-fail — never block session start
		}
	}

	// Restore session state if present
	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd || process.cwd();
		repoRoot = resolveDarkmanRoot(cwd);

		// Pi-dedicated env first (repo .pi/darkman-x-pi.env), then cwd/root fallbacks
		const envInfo = loadPiEnv(cwd, repoRoot);
		if (envInfo.loaded.some((f) => f.endsWith("darkman-x-pi.env"))) {
			ctx.ui.notify(
				hasUsableFishKey()
					? "darkman-x-pi.env loaded (FISH_API_KEY set)"
					: "darkman-x-pi.env loaded — paste FISH_API_KEY into .pi/darkman-x-pi.env",
				hasUsableFishKey() ? "info" : "warning",
			);
		} else if (!hasUsableFishKey()) {
			// only nudge when voice is on and key missing
		}

		const defaultMode = resolveDefaultMode(cwd);
		state.mode = defaultMode;
		state.prevMode = INDEPENDENT.has(defaultMode) ? "full" : defaultMode;
		state.voice = resolveVoiceDefault();
		state.sfx = resolveSfxDefault();

		reconstructFromSession(ctx);
		refreshRules();
		setStatus(ctx, state);

		if (state.mode !== "off") {
			const badge = `${state.voice ? " +VOICE" : ""}${state.sfx ? " +SFX" : ""}`;
			ctx.ui.notify(`darkman-x ${state.mode}${badge}`, "info");
		}
	});

	pi.on("session_tree", async (_event, ctx) => {
		reconstructFromSession(ctx);
		refreshRules();
		setStatus(ctx, state);
	});

	// Inject rules every turn while active
	pi.on("before_agent_start", async (event) => {
		if (state.mode === "off" || !rulesCache) return undefined;

		const vs = voiceSettings();
		// Match Claude SessionStart voiceRulesBlock (ccfa86f): full reply, not a 2-sentence cap.
		const tool =
			speakPath(cwd, repoRoot) || path.join(repoRoot, "src", "tools", "darkman-x-speak.js");
		const voiceBlock = state.voice
			? [
					"",
					"## Voice (Fish Audio — ON)",
					"Spoken replies are enabled for this session.",
					`- Model: \`${vs.model}\``,
					`- Voice reference_id: \`${vs.voiceId}\``,
					"- After each conversational reply (not code/commits/PRs), speak it by running:",
					`  \`node "${tool}" --quiet -- "YOUR SPOKEN VERSION"\``,
					"- Speak the full substance, not a trimmed summary — cover every point you made, in natural spoken prose. Rewrite markdown into flowing sentences (no headers, bullets, asterisks, backticks read aloud). Skip code blocks, commands, paths, and URLs entirely. No hard length cap — match the length of the actual reply.",
					"- If FISH_API_KEY is missing, skip speaking silently — do not fail the turn.",
					'- Toggle: `/darkman-x voice off` or say "stop speaking".',
				].join("\n")
			: "";

		const sfxTool = sfxPath(cwd, repoRoot) || path.join(repoRoot, "src", "tools", "darkman-x-sfx.js");
		// Match Claude's darkman-x-activate.js sfxRulesBlock() wording exactly.
		const sfxBlock = state.sfx
			? [
					"",
					"## SFX (DMX sound clips — ON, personal use only)",
					"A small library of DMX audio clips is available, out-of-tree (never committed, never in code/commits/PRs).",
					`- List what exists: \`node "${sfxTool}" --list\``,
					`- Play one: \`node "${sfxTool}" --quiet <clip-name>\` (fuzzy match on name, case-insensitive)`,
					'- This is fully your call, not a fixed trigger table. Use real judgment on when a moment earns one — a genuine win, activation, something funny, hype, or just because. No fixed schedule, no per-turn requirement, no held-back clips. Personal machine only — enjoy it, but "every now and then" beats every single reply.',
					"- Missing/unmatched clip → skip silently, never fail the turn over it.",
					"- Toggle: `/darkman-x sfx off`.",
				].join("\n")
			: "";

		return {
			systemPrompt:
				event.systemPrompt +
				`

## darkman-x (${state.mode})

${rulesCache}
${voiceBlock}
${sfxBlock}
`,
		};
	});

	// After agent finishes a one-shot independent mode, restore prose mode
	pi.on("agent_end", async (_event, ctx) => {
		if (INDEPENDENT.has(state.mode)) {
			const restore = state.prevMode && !INDEPENDENT.has(state.prevMode) ? state.prevMode : "full";
			state.mode = restore;
			refreshRules();
			setStatus(ctx, state);
			pi.appendEntry(STATE_TYPE, { ...state });
		}
	});

	pi.registerCommand("darkman-x", {
		description: "Switch darkman-x mode (lite|full|ultra|wenyan…|off) or voice on|off|status",
		handler: async (args, ctx) => {
			const raw = (args || "").trim();
			if (!raw) {
				applyMode("full", ctx);
				return;
			}

			const parts = raw.split(/\s+/);
			const head = parts[0].toLowerCase();

			// Natural language off
			if (
				raw.toLowerCase() === "stop" ||
				raw.toLowerCase() === "stop darkman-x" ||
				raw.toLowerCase() === "normal" ||
				raw.toLowerCase() === "normal mode"
			) {
				applyMode("off", ctx);
				return;
			}

			if (head === "voice") {
				const sub = (parts[1] || "status").toLowerCase();
				const vs = voiceSettings();
				if (sub === "on") {
					state.voice = true;
					writeVoiceFlag(true);
				} else if (sub === "off") {
					state.voice = false;
					writeVoiceFlag(false);
				} else if (sub === "toggle") {
					state.voice = !state.voice;
					writeVoiceFlag(state.voice);
				} else if (sub !== "status") {
					ctx.ui.notify(`Unknown voice subcommand: ${sub}. Use on|off|status|toggle.`, "warning");
					return;
				}
				setStatus(ctx, state);
				pi.appendEntry(STATE_TYPE, { ...state });
				ctx.ui.notify(
					`voice ${state.voice ? "ON" : "OFF"} · model ${vs.model} · id ${vs.voiceId}`,
					"info",
				);
				return;
			}

			if (head === "sfx") {
				const sub = (parts[1] || "status").toLowerCase();
				if (sub === "on") {
					state.sfx = true;
					writeSfxFlag(true);
				} else if (sub === "off") {
					state.sfx = false;
					writeSfxFlag(false);
				} else if (sub === "toggle") {
					state.sfx = !state.sfx;
					writeSfxFlag(state.sfx);
				} else if (sub !== "status") {
					ctx.ui.notify(`Unknown sfx subcommand: ${sub}. Use on|off|status|toggle.`, "warning");
					return;
				}
				setStatus(ctx, state);
				pi.appendEntry(STATE_TYPE, { ...state });
				ctx.ui.notify(`sfx ${state.sfx ? "ON" : "OFF"}`, "info");
				return;
			}

			const mode = normalizeMode(raw);
			if (!mode) {
				ctx.ui.notify(
					`Unknown mode: ${raw}. Use off|lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra|voice on|off`,
					"warning",
				);
				return;
			}
			applyMode(mode, ctx);
		},
	});

	pi.registerCommand("darkman-x-voice", {
		description: "Toggle Fish Audio spoken replies (s2.1-pro-free)",
		handler: async (args, ctx) => {
			const sub = ((args || "status").trim().split(/\s+/)[0] || "status").toLowerCase();
			const vs = voiceSettings();
			if (sub === "on") {
				state.voice = true;
				writeVoiceFlag(true);
			} else if (sub === "off") {
				state.voice = false;
				writeVoiceFlag(false);
			} else if (sub === "toggle") {
				state.voice = !state.voice;
				writeVoiceFlag(state.voice);
			} else if (sub === "status") {
				// fall through to notify
			} else if (sub === "test") {
				trySpeak(cwd, repoRoot, "darkman-x voice test. Short. Hard. Exact.");
				ctx.ui.notify(`voice test sent · model ${vs.model}`, "info");
				return;
			} else {
				ctx.ui.notify(`Unknown: ${sub}. Use on|off|status|toggle|test`, "warning");
				return;
			}
			setStatus(ctx, state);
			pi.appendEntry(STATE_TYPE, { ...state });
			ctx.ui.notify(
				`voice ${state.voice ? "ON" : "OFF"} · model ${vs.model} · id ${vs.voiceId}`,
				"info",
			);
		},
	});

	pi.registerCommand("darkman-x-sfx", {
		description: "Toggle DMX sound clips (personal use, out-of-tree)",
		handler: async (args, ctx) => {
			const sub = ((args || "status").trim().split(/\s+/)[0] || "status").toLowerCase();
			if (sub === "on") {
				state.sfx = true;
				writeSfxFlag(true);
			} else if (sub === "off") {
				state.sfx = false;
				writeSfxFlag(false);
			} else if (sub === "toggle") {
				state.sfx = !state.sfx;
				writeSfxFlag(state.sfx);
			} else if (sub === "status") {
				// fall through to notify
			} else if (sub === "test") {
				trySfx(cwd, repoRoot, "bark");
				ctx.ui.notify("sfx test sent", "info");
				return;
			} else {
				ctx.ui.notify(`Unknown: ${sub}. Use on|off|status|toggle|test`, "warning");
				return;
			}
			setStatus(ctx, state);
			pi.appendEntry(STATE_TYPE, { ...state });
			ctx.ui.notify(`sfx ${state.sfx ? "ON" : "OFF"}`, "info");
		},
	});

	pi.registerCommand("darkman-x-status", {
		description: "Show darkman-x mode + voice + sfx state",
		handler: async (_args, ctx) => {
			const vs = voiceSettings();
			ctx.ui.notify(
				`mode=${state.mode} prev=${state.prevMode} voice=${state.voice ? "ON" : "OFF"} sfx=${state.sfx ? "ON" : "OFF"} model=${vs.model}`,
				"info",
			);
		},
	});
}
