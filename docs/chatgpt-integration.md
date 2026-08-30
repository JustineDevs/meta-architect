# ChatGPT Integration

Meta-Architect is currently a local CLI and skill/plugin distribution. Its
MCP capabilities run in-process from `mcp/local/`; they are not a public HTTPS
service. Therefore the repository cannot honestly be submitted as a live
ChatGPT app or GPT Action until a separately deployed backend exists.

## Supported path

Use the OpenAI plugin/app path when a deployed MCP server will expose
Meta-Architect capabilities to ChatGPT. Use GPT Actions only when the product
needs a public HTTPS REST API described by an OpenAPI 3.1 document.

The local package remains the canonical implementation:

```bash
npm i -g @jstn-sdk/ma@latest
ma --madmax --high
```

The backend adapter must expose only the existing, bounded MCP capabilities:

- read-only project context and code intelligence
- playbooks and quality evidence
- trace and runtime status
- proposal-only state and team operations
- authority-checked writes where the local contract permits them

It must not expose local paths, raw secrets, workspace credentials, or
unbounded shell execution.

## Publication checklist

Before submitting a ChatGPT integration, the deployment must provide:

1. A stable HTTPS MCP endpoint with TLS and request timeouts.
2. Authentication appropriate to the data and write scope, normally OAuth for
   user-specific or mutating operations.
3. Typed tool schemas, bounded responses, rate limiting, and sanitized logs.
4. A privacy/data-use explanation, support contact, icon, test account or
   sandbox, and reviewer notes.
5. Integration tests for malformed input, denied authority, expired tokens,
   upstream timeouts, 429 responses, and rollback.

Submit through the [OpenAI plugin submission guidance](https://developers.openai.com/plugins/deploy/submission)
after the endpoint and review materials are available. Do not represent the
local `.mcp.json` or in-process modules as a published ChatGPT integration.

## Current status

| Surface | Status |
| --- | --- |
| Local MA MCP capabilities | Available and tested |
| ChatGPT-compatible backend | Not deployed |
| OAuth client and callback | Not configured |
| OpenAPI GPT Action | Not provided |
| OpenAI publication submission | Requires deployment and credentials |
