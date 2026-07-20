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
import { spawnSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

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
function loadPiEnv(cwd: string): { loaded: string[] } {
	const loaded: string[] = [];
	const candidates = [
		path.join(cwd, ".pi", "darkman-x-pi.env"), // Pi owns this
		path.join(cwd, ".env"), // root fallback
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

function skillCandidates(cwd: string): string[] {
	return [
		path.join(cwd, "skills", "darkman-x", "SKILL.md"),
		path.join(cwd, ".pi", "skills", "darkman-x", "SKILL.md"),
		path.join(cwd, "plugins", "darkman-x", "skills", "darkman-x", "SKILL.md"),
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

function loadModeRules(cwd: string, mode: string): string {
	if (mode === "off") return "";

	for (const p of skillCandidates(cwd)) {
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

function speakPath(cwd: string): string | null {
	const candidates = [
		path.join(cwd, "src", "tools", "darkman-x-speak.js"),
		path.join(cwd, "bin", "darkman-x-speak.js"),
	];
	for (const p of candidates) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

function trySpeak(cwd: string, text: string): void {
	const script = speakPath(cwd);
	if (!script) return;
	try {
		spawnSync(process.execPath, [script, text], {
			cwd,
			stdio: "ignore",
			timeout: 30_000,
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
	ctx.ui.setStatus("darkman-x", `darkman-x:${state.mode}${voiceBit}`);
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
	const state: State = {
		mode: "full",
		prevMode: "full",
		voice: false,
	};
	let cwd = process.cwd();
	let rulesCache = "";

	function refreshRules(): void {
		rulesCache = state.mode === "off" ? "" : loadModeRules(cwd, state.mode);
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
				ctx.ui.notify(`darkman-x ${state.mode}${state.voice ? " +VOICE" : ""}`, "info");
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
			}
		} catch {
			// silent-fail — never block session start
		}
	}

	// Restore session state if present
	pi.on("session_start", async (_event, ctx) => {
		cwd = ctx.cwd || process.cwd();

		// Pi grabs its own env first (.pi/darkman-x-pi.env), then root .env fallback
		const envInfo = loadPiEnv(cwd);
		if (envInfo.loaded.some((f) => f.endsWith("darkman-x-pi.env"))) {
			ctx.ui.notify(
				hasUsableFishKey()
					? "darkman-x-pi.env loaded (FISH_API_KEY set)"
					: "darkman-x-pi.env loaded — paste FISH_API_KEY into .pi/darkman-x-pi.env",
				hasUsableFishKey() ? "info" : "warning",
			);
		}

		const defaultMode = resolveDefaultMode(cwd);
		state.mode = defaultMode;
		state.prevMode = INDEPENDENT.has(defaultMode) ? "full" : defaultMode;
		state.voice = resolveVoiceDefault();

		reconstructFromSession(ctx);
		refreshRules();
		setStatus(ctx, state);

		if (state.mode !== "off") {
			ctx.ui.notify(`darkman-x ${state.mode}${state.voice ? " +VOICE" : ""}`, "info");
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
		const tool = speakPath(cwd) || path.join(cwd, "src", "tools", "darkman-x-speak.js");
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

		return {
			systemPrompt:
				event.systemPrompt +
				`

## darkman-x (${state.mode})

${rulesCache}
${voiceBlock}
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
				trySpeak(cwd, "darkman-x voice test. Short. Hard. Exact.");
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

	pi.registerCommand("darkman-x-status", {
		description: "Show darkman-x mode + voice state",
		handler: async (_args, ctx) => {
			const vs = voiceSettings();
			ctx.ui.notify(
				`mode=${state.mode} prev=${state.prevMode} voice=${state.voice ? "ON" : "OFF"} model=${vs.model}`,
				"info",
			);
		},
	});
}
