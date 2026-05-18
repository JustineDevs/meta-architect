# Core Release Rules

- Required status fields live in `.ma/decisions.json` and `.ma/release.json`.
- `$build` is blocked unless:
  - `idea_status = CLEAR`
  - `architecture_status = APPROVED`
  - `evidence_status = VERIFIED`
  - `logic_status = GREEN`
  - `security_status = GREEN`
  - `experience_status = GREEN` or `WAIVED`
- Feature work merges into `development`, never directly into `prod`.
- Release promotion is allowed only from `development` or approved `release/*`.
- Use the helper command path only when repo-local state automation is explicitly needed; otherwise stay inside Codex and carry the gate decisions in the session.
