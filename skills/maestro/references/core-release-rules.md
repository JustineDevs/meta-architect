# Core Release Rules

- Required status fields live in `.ma/decisions.json` and `.ma/release.json`.
- `$build` is blocked unless:
  - `idea_status = CLEAR`
  - `architecture_status = APPROVED`
  - `evidence_status = VERIFIED`
  - `logic_status = GREEN`
  - `security_status = GREEN`
  - `experience_status = GREEN` or `WAIVED`
- Human work is completed on `dev`; `main` is protected and release-facing.
- Release promotion is allowed only from `dev` to `main`.
- Use the helper command path only when repo-local state automation is explicitly needed; otherwise stay inside Codex and carry the gate decisions in the session.
