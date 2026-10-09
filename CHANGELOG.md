# Changelog

## 1.0.0-beta.3 — 2026-10-09

- Cover 32 Developer API operations and 14 scopes with typed resource namespaces, including instance discovery, contacts, labels, static segments, conversations, templates, reports and webhook management.
- Add nine raw message variants, persisted send idempotency keys, message status reads, bounded pagination and streaming media downloads.
- Add Form launch/detail metadata, carousel media/product cards and ownership bindings, location headers, limited-time offers, coupon codes and external Flow tokens.
- Add raw-byte webhook verification and durable receiver guidance. Preserve the text/template helpers, safe errors and zero automatic retries.
- Translate segment description null to the API's empty string, accept empty descriptions and align timestamp filters with RFC3339.
- Prepare a sanitized public-source repository with official repository and issue links.
- Exclude maintainer-only publishing instructions from future npm tarballs.
- Add a public security-reporting policy and remove the staging hostname from the public environment example.
- Keep release errors self-contained without references to private maintainer files.
- Preserve CI for every main commit and publish only after successful main CI plus owner approval, using npm Trusted Publishing and provenance.
- Select the current prerelease explicitly in setup instructions and record source/artifact integrity in publishing summaries.

## 1.0.0-beta.2 — 2026-09-12

- Add conservative `outcomeUnknown` classification to HTTP errors, preserving status/code and the no-retry policy.
- Retain caller request IDs on transport errors and reject invalid response correlation headers.
- Add template recipes, code-to-action troubleshooting, setup and support guidance.
- Add clean-commit verification and tarball-integrity release evidence.
- Keep scope limited to text/template sends; no new platform endpoint or commercial gate.

## 1.0.0-beta.1 — 2026-09-11

Initial phase-one package: environment key configuration, number-bound sender selection, text and template methods, template parameter types, local validation, bounded responses, deadlines/abort, structured errors and zero automatic send retries. Published to npm; live account acceptance remains a separate environment check.
