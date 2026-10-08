# Changelog

## Unreleased

- Add typed namespaces for all 26 operations in the reviewed Developer API expansion contract.
- Add nine raw message variants, persistent send idempotency keys, message status reads, pagination, streaming media, workspace contacts/labels/segments, template discovery, activity reports and revisioned webhook management.
- Add raw-byte webhook verification, durable receiver guidance, pinned contract coverage and explicit API/staging release blockers.
- Preserve the existing text/template helpers, Node.js floor, safe errors and zero automatic retries.

This section describes source changes only. It is not an npm release or proof of API deployment.

## 1.0.0-beta.3 — 2026-09-13

- Prepare a sanitized public-source repository with official repository and issue links.
- Exclude maintainer-only publishing instructions from future npm tarballs.
- Add a public security-reporting policy and remove the staging hostname from the public environment example.
- Keep release errors self-contained without references to private maintainer files.
- Add pinned, least-privilege GitHub Actions for multi-version CI and tokenless npm publishing with provenance.

## 1.0.0-beta.2 — 2026-09-12

- Add conservative `outcomeUnknown` classification to HTTP errors, preserving status/code and the no-retry policy.
- Retain caller request IDs on transport errors and reject invalid response correlation headers.
- Add template recipes, code-to-action troubleshooting, setup and support guidance.
- Add clean-commit verification and tarball-integrity release evidence.
- Keep scope limited to text/template sends; no new platform endpoint or commercial gate.

## 1.0.0-beta.1 — 2026-09-11

Initial phase-one package: environment key configuration, number-bound sender selection, text and template methods, template parameter types, local validation, bounded responses, deadlines/abort, structured errors and zero automatic send retries. Published to npm; live account acceptance remains a separate environment check.

### Current API parity (unreleased)

- Cover 32 operations, including instance capability discovery, label create/update/archive and static segment update/archive.
- Add typed Form launch/detail metadata, carousel media/product cards and ownership bindings, location, offer, coupon and external Flow-token parameters.
- Preserve text/template convenience inputs, error classes and zero-retry behavior. Translate segment description null to the API's empty string, and accept empty descriptions.
- Align timestamp filter validation with RFC3339 and document custom-field catalog, pagination, auth and import boundaries. No package publication or deployment is implied.
