# Secret protection and deployment review

Reviewed current server configuration, AI provider, Vite configuration and ignore rules. No actual key was requested or used. The server reads the key from its environment; the example file has an empty value. Expanded ignore rules, validated settings, and replaced selected raw provider errors in logs and responses. The real providers now require a loopback bind address. Mock mode can bind externally, but project APIs still have no authorization; never expose private project data. A reverse proxy or tunnel defeats loopback-only isolation: real AI requires authentication, project authorization and rate limiting before public deployment.

## Remaining verification

Run a full history scan locally (all branches/tags) with a maintained secret scanner, e.g. `gitleaks git --redact`. Do not post secret values into issues/PRs. If a key is found, revoke and rotate it immediately. This review is not a complete historical scan or penetration test. Check CI and run `npm run dev:mock` before merging. Do not expose a real provider using public Vite proxying.
