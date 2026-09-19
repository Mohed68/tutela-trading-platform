# TUTELA Agent Layer — Installation

This bundle is designed for the TUTELA repository root.

Copy the bundle contents into:

`C:\Users\M.Emad\Desktop\TUTELA`

so the repository contains:

`.agents/skills/tutela-engineering/SKILL.md`
`docs/agent/TUTELA_DELTA_A_SPEC.md`

OpenAI's Codex local-skill discovery scans `.agents/skills` from the current working directory up to the repository root.

After the files are present, restart Codex/ChatGPT Desktop only if the skill does not appear automatically.

Explicit invocation:

`$tutela-engineering`

Recommended Delta A task prompt:

Use `$tutela-engineering`.

Accepted baseline:
`96f7dca22b7b01a238dfdf9464ca71f9838d844c`

Execute:
`docs/agent/TUTELA_DELTA_A_SPEC.md`

No outside changes have been made since the accepted baseline.
Run Baseline Integrity Preflight only; do not repeat the completed full repository audit.

Implement the delta autonomously through testing, safe migration/deployment if required, Production verification, documentation synchronization, and the standard TUTELA completion report.
