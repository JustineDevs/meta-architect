---
name: meta-architect-vet
description: "Use when Codex needs to run or inspect the Meta-Architect `$vet` lane for security review, risk logging, and CVE-style findings. Trigger for requests about security posture, safer alternatives, audit evidence, or whether the build should stay blocked on security grounds."
---

# Meta-Architect Vet

Run the security-review lane through:

```bash
ma run $vet
```

Expected effects:
- Writes audit findings to `.meta-architect/evidence/audits.json` and `.meta-architect/evidence/cves.json`.
- Appends a security decision entry to `.meta-architect/decisions.json`.
- Advances `security_status` to `GREEN` unless unresolved blockers remain.

Use this skill after `$flow` and before `$vibe`.
