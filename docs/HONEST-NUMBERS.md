# Honest numbers

darkman-x claims roughly **65% fewer output tokens** in `full` mode. Here's exactly what that means and doesn't mean.

## What was measured

- **Output tokens only.** This is the size of the agent's own response — not your prompt, not tool-call payloads, not cached context. Input/total-token savings are much smaller (compression only touches what the model writes back to you).
- Measured on real sessions against the analyzed upstream product, comparing default-voice output token counts to darkman-x `full`-mode output token counts for equivalent responses.
- Code, commands, error text, and file paths are preserved byte-exact — none of that is compressed, so the savings come entirely from cut prose (filler, hedging, restated questions, pleasantries).

## What this is not

- Not a total-cost reduction guarantee. If your session is mostly tool calls and file reads, output tokens may already be a small share of total spend.
- Not a fixed number. Actual savings depend on: how verbose the underlying model already is, the task (a one-line answer compresses less than a multi-paragraph explanation), and which level you're running (`lite` saves less than `ultra`).
- Not independently reproduced per-model. Different model families have different baseline verbosity; the ~65% figure is not a promise for every model/agent combination.

## How to check your own numbers

```bash
# Local, on-device, reads only your own session logs — nothing leaves your machine
/darkman-x-stats

# Or, with an API key, run the reproducible benchmark
npm run bench
```

If a number in this repo's docs or README doesn't match what you measure, trust your own measurement and file an issue — we'd rather correct a claim than inflate one.
