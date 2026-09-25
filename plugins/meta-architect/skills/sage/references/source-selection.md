# Source Selection

Use this reference pack inside `$sage` when the repo needs evidence-backed selection without turning raw catalogs into the product surface.

## Evidence order

1. Known upstream repo and official docs
2. Discovery accelerator to find or narrow candidates
3. Exact upstream repo mapping for the shortlisted candidate
4. Upstream repo plus official-doc verification before approval

## Discovery accelerator rules

- Use accelerators to reduce search time, not to replace validation.
- Treat listings, rankings, and trend signals as hints.
- Promote any serious candidate to an exact upstream repo before calling it VERIFIED.
- Keep user-facing guidance in Meta-Architect language rather than echoing catalog branding as if it were a first-class product surface.

## Minimum approval bar

- Exact upstream repo identified
- Official docs available when relevant
- Claimed capability verified from a primary source
- Maturity caveats called out when evidence is weak

## Evidence grades

- `VERIFIED`: exact upstream mapping plus primary-source confirmation
- `PARTIAL`: candidate is mapped, but live proof or maturity proof is incomplete
- `MISSING`: no trustworthy exact upstream mapping yet

Always expose the evidence grade and the exact upstream mapping in user-facing `$sage` output.

## Native posture

Meta-Architect ships curated guidance and playbooks. It does not ship a raw mirror of external catalogs. External sources remain evidence inputs, not user-facing skill identities.
