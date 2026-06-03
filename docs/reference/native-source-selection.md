# Native Source Selection

Meta-Architect uses external discovery surfaces as inputs to native source-selection guidance, not as first-class product faces.

## Evidence ladder

1. known upstream repo and official docs
2. discovery accelerators for narrowing candidates
3. exact upstream repo mapping
4. upstream and official-doc verification before approval

## Product rule

- discovery lists help candidate selection
- verification still depends on primary sources
- packaged references should explain the selection posture in Meta-Architect language

## Routing

- `$sage` owns source selection and evidence quality
- helper skills can support preparation, but they do not replace `$sage`

## Evidence grades

- `VERIFIED`: exact upstream mapping plus primary-source confirmation
- `PARTIAL`: candidate is mapped, but live proof or maturity proof is incomplete
- `MISSING`: no trustworthy exact upstream mapping yet
