"""Registry of locally-installed, already-authenticated agent CLIs used to
perform the actual compress rewrite. No API keys: each entry spawns the same
binary you already log into for interactive use (`claude`, `codex`, `grok`,
`pi`) in a one-shot, non-interactive mode and reads its subscription auth
from whatever config that CLI already keeps on disk.

Registry shape mirrors the non-interactive agent spec pattern (binary,
prompt-delivery mode, arg builder, default model) used by ANOMALYZ's
COMMIT_MESSAGE_AGENT_SPECS for its AI commit-message generator.
"""

import os
import shutil
import subprocess

DEFAULT_TIMEOUT_SECONDS = 120


class NoAgentAvailable(Exception):
    pass


class AgentCallFailed(Exception):
    pass


def _claude_args(model):
    return [
        "-p",
        "--output-format",
        "text",
        "--model",
        model,
        "--permission-mode",
        "plan",
    ]


def _codex_args(model):
    return [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "-s",
        "read-only",
        "--model",
        model,
    ]


def _pi_args(model):
    return [
        "--print",
        "--no-session",
        "--no-tools",
        "--no-extensions",
        "--no-skills",
        "--no-context-files",
        "--mode",
        "text",
        "--model",
        model,
    ]


def _grok_args(model):
    # Verified against a real (unauthenticated) local install of `grok`
    # 0.2.102: `-p/--single <PROMPT>` is a value-taking flag that greedily
    # consumes the very next argv token, so it MUST be the last flag with the
    # prompt as its immediate value — see `prompt_arg` below, which enforces
    # that ordering rather than relying on this function to do it. Confirmed
    # this exact combination reaches grok's real auth check (not a clap parse
    # error): `grok --model <model> --permission-mode plan --output-format
    # plain -p "<prompt>"`.
    args = ["--permission-mode", "plan", "--output-format", "plain"]
    if model:
        args += ["--model", model]
    return args


# Each spec: binary to spawn, and either:
#   "stdin": True                -> prompt is piped on stdin, no argv changes
#   "prompt_arg": "<flag>"       -> `<flag> <prompt>` appended as the final
#                                    two argv tokens, after every other flag
#                                    from build_args (some CLIs' prompt flag
#                                    greedily consumes the next token, so it
#                                    must be last)
AGENT_SPECS = {
    "claude": {
        "binary": "claude",
        "stdin": True,
        "build_args": _claude_args,
        "default_model": "sonnet",
    },
    "codex": {
        "binary": "codex",
        "stdin": True,
        "build_args": _codex_args,
        "default_model": "gpt-5.5",
    },
    "grok": {
        "stdin": False,
        "prompt_arg": "-p",
        "binary": "grok",
        "build_args": _grok_args,
        "default_model": None,
    },
    "pi": {
        "binary": "pi",
        "stdin": True,
        "build_args": _pi_args,
        "default_model": "github-copilot/gpt-5.4-mini",
    },
}

DEFAULT_AGENT_ORDER = ("claude", "codex", "grok", "pi")


def _agent_order():
    raw = os.environ.get("DARKMANX_COMPRESS_AGENT_ORDER")
    if not raw:
        return DEFAULT_AGENT_ORDER
    order = [a.strip() for a in raw.split(",") if a.strip()]
    return tuple(a for a in order if a in AGENT_SPECS) or DEFAULT_AGENT_ORDER


def pick_agent():
    """Resolve which agent CLI to spawn. Never touches API keys.

    Resolution order:
    1. `DARKMANX_COMPRESS_AGENT` env var, if set to a known id AND that
       binary is actually on PATH.
    2. First binary found on PATH from `DARKMANX_COMPRESS_AGENT_ORDER`
       (default: claude, codex, grok, pi) — i.e. prefer Claude Code, fall
       back through your other configured subscriptions in order, and use
       whichever one is actually installed/logged in.
    Raises NoAgentAvailable if nothing on the order list is installed.
    """
    forced = os.environ.get("DARKMANX_COMPRESS_AGENT")
    if forced and forced in AGENT_SPECS and shutil.which(AGENT_SPECS[forced]["binary"]):
        return forced

    for agent_id in _agent_order():
        spec = AGENT_SPECS[agent_id]
        if shutil.which(spec["binary"]):
            return agent_id

    raise NoAgentAvailable(
        "no configured agent CLI found on PATH (tried: "
        + ", ".join(_agent_order())
        + "). Install/log into one of these CLIs with your existing "
        "subscription (claude, codex, grok, pi) — no API key needed."
    )


def _model_for(agent_id):
    env_key = "DARKMANX_COMPRESS_MODEL_" + agent_id.upper()
    return (
        os.environ.get(env_key)
        or os.environ.get("DARKMANX_COMPRESS_MODEL")
        or AGENT_SPECS[agent_id]["default_model"]
    )


def run_agent(prompt, agent_id=None):
    """Spawn the resolved (or given) agent CLI non-interactively with `prompt`
    and return its captured stdout, stripped. Raises AgentCallFailed on a
    non-zero exit, timeout, or spawn error — never raises for "no API key",
    because none is used."""
    agent_id = agent_id or pick_agent()
    spec = AGENT_SPECS[agent_id]
    model = _model_for(agent_id)
    args = [spec["binary"]] + spec["build_args"](model)

    timeout = float(os.environ.get("DARKMANX_COMPRESS_TIMEOUT", DEFAULT_TIMEOUT_SECONDS))

    if spec["stdin"]:
        run_input = prompt
        run_args = args
    else:
        run_input = None
        # prompt_arg's flag must stay adjacent to the prompt and last in argv
        # — some CLIs' prompt flag (e.g. grok's -p) greedily consumes the
        # very next token as its value, so anything after it (like --model)
        # would otherwise get swallowed as the prompt instead.
        run_args = args + [spec["prompt_arg"], prompt]

    try:
        result = subprocess.run(
            run_args,
            input=run_input,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as e:
        raise AgentCallFailed(f"{spec['binary']}: binary disappeared from PATH: {e}")
    except subprocess.TimeoutExpired:
        raise AgentCallFailed(f"{spec['binary']}: timed out after {timeout}s")

    if result.returncode != 0:
        stderr_excerpt = (result.stderr or "").strip()[:500]
        raise AgentCallFailed(
            f"{spec['binary']} exited {result.returncode}: {stderr_excerpt}"
        )

    return result.stdout.strip()
