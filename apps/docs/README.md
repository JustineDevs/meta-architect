# Meta-Architect documentation

The public documentation site for Meta-Architect `v0.15.0` is a Fumadocs
application backed by MDX in `content/docs`. The repository-level `docs/`
directory remains the engineering record; this app is the clear product guide
for users and operators.

## Development

```bash
cd apps/docs
npm install
npm run dev
```

Open `http://localhost:3000/docs`.

The documentation covers the same supported workflow as the package README:
install `@jstn-sdk/ma`, run `ma setup`, configure `TYPESAFE_API_KEY` for
autonomous Jev routing, launch the host, and give `$maestro` one goal. See the
package root README for the canonical installation variants and release links.

## Content rules

- Start with the user's task, not the implementation history.
- Put concepts in `concepts/`, task instructions in `guides/`, stable contracts
  in `reference/`, and maintenance material in `operations/`.
- Every guide states prerequisites, expected result, and verification.
- Keep examples copyable and explain only the decision the reader needs.
