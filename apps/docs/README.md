# Meta-Architect documentation

The public documentation site for Meta-Architect `v0.15.3` is a Fumadocs
application backed by MDX in `content/docs`. The repository-level `docs/`
directory remains the engineering record; this app is the evergreen product
guide for users and operators.

## Development

```bash
cd apps/docs
npm install
npm run dev
```

Open `http://localhost:3000/docs`.

The existing Vercel `docs` project builds this app from the repository
`apps/docs` root. Keep that project root aligned with this directory when
running a preview or production deployment.

The documentation covers the same supported workflow as the package README:
install `@jstn-sdk/ma`, optionally configure TypeSafe once with `ma auth
typesafe` for live Jev routing, run `ma setup`, launch the host, and give
`$maestro` one goal. Without TypeSafe, Maestro uses bounded local routing. See
the package root README for the canonical installation variants and release
links.

## Provider configuration

The interactive command stores the credential once for the current user:

```bash
ma auth typesafe
ma auth typesafe --status
```

The default file is `~/.config/meta-architect/provider.env` with owner-only
permissions. For project-local configuration, use `.env.local`:

```dotenv
TYPESAFE_API_KEY=jv_live_your_key
TYPESAFE_DEFAULT_MODEL=jev-latest
```

Explicit environment variables override dotenv files, and `.env.local`
overrides `.env`. Credentials are not written to `.ma/`, receipts, logs, or
generated context. Use `ma auth typesafe --clear` to remove the saved global
credential.

## Content rules

- Start with the user's task, not the implementation history.
- Put concepts in `concepts/`, task instructions in `guides/`, stable contracts
  in `reference/`, and maintenance material in `operations/`.
- Every guide states prerequisites, expected result, and verification.
- Keep examples copyable and explain only the decision the reader needs.
- Keep release-specific evidence in the repository-level `docs/` directory.
