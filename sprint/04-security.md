# Sprint 4: Security

## Goal

Record a baseline security pass and keep the workflow blocked if prerequisites are not satisfied.

## Inputs

- `logic_status = GREEN`

## Expected outputs

- `.omx/evidence/audits.json`
- `.omx/evidence/cves.json`
- `security_status = GREEN | RED`

## Exit criteria

- baseline security findings are recorded
- blockers are explicit when the lane remains red

## Failure conditions

- logic not green
- missing evidence output
