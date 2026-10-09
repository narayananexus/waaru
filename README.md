# Waaru SDK

[![CI](https://github.com/narayananexus/waaru/actions/workflows/ci.yml/badge.svg)](https://github.com/narayananexus/waaru/actions/workflows/ci.yml)

[Website](https://www.waaru.app) · [Documentation](https://www.waaru.app/docs) · [npm package](https://www.npmjs.com/package/@waaru/sdk) · [Source](https://github.com/narayananexus/waaru)

Use Waaru's server-side Developer API through typed Node.js functions. Includes TypeScript declarations, zero runtime dependencies and Node.js 22.14+ support.

This guide describes `1.0.0-beta.3`, which covers 32 Developer API operations. Earlier versions support text and template sending only. See [API coverage](docs/api-coverage.md) for methods, scopes and runtime requirements.

## 1. Install

```sh
npm install @waaru/sdk@beta
```

This is a beta release. Check `npm view @waaru/sdk dist-tags` before installing. Idempotency keys and the expanded resource methods below require `1.0.0-beta.3` or later. The `beta` tag selects the newest prerelease; an unqualified install selects `latest`.

## 2. Add your API key

In Waaru **Settings → Developer**, select your connected WhatsApp number, enable Developer API mode, and create a key with `messages:send` permission. Save it in your server's `.env`:

```dotenv
WAARU_API_KEY=wak_your_actual_api_key
```

The key is permanently mapped to your sending WhatsApp number. You do not pass a sender number to the SDK. `to` is your customer's number, including `+` and country code. Keep your key on the server; never put it in browser code or a `NEXT_PUBLIC_` variable.

Developer API mode changes inbound ownership: Logic Flow and automatic replies stop handling new inbound messages for that number. Inbox visibility and safety processing remain. Review this choice before switching. Human takeover can block API sends until an authorized operator releases the conversation in Waaru.

## 3. Send a message

Create `send.mjs`:

```js
import { Waaru } from '@waaru/sdk';

const waaru = new Waaru(); // reads WAARU_API_KEY

// Persist this key with the logical send before the first attempt.
const idempotencyKey = 'order:ORDER-123:ready';
const result = await waaru.messages.sendText(
  { to: '+14155552671', text: 'Your order is ready.' },
  { idempotencyKey },
);

console.log(result.messageId, result.status);
```

Run it with your environment loaded:

```sh
node --env-file=.env send.mjs
```

Text messages require an eligible conversation within the 24-hour customer-service window. Outside that window, use an approved template.

## Send a template

```js
const result = await waaru.messages.sendTemplate({
  to: '+14155552671',
  name: 'order_update',
  language: 'en_US',
  components: [{
    type: 'body',
    parameters: [
      { type: 'text', text: 'Ada' },
      { type: 'text', text: 'ORDER-123' },
    ],
  }],
});
```

Use your exact approved template name, language and variable order. Omit `components` when your template has no variables. Header/body/button components support the existing Waaru parameter types: text, currency, date_time, image, video and document. Media parameters use public HTTPS links.

See [runnable template recipes](examples/README.md) for no-variable, positional, named, media-header and URL-button shapes. Each must match your approved template. The SDK also supports Form launch metadata, carousel media/product cards, location headers, limited-time offers and coupon-code buttons. Quick-reply `payload` parameters are supported inside carousel cards; they are not supported by ordinary template components. See [current template capabilities](docs/api-coverage.md#current-template-capabilities) for the exact shapes.

## Sending numbers and errors

For multiple sending numbers, create a client with each number's key:

```js
const sales = new Waaru({ apiKey: process.env.WAARU_SALES_API_KEY });
const support = new Waaru({ apiKey: process.env.WAARU_SUPPORT_API_KEY });
```

`status: 'queued'` means accepted, not delivered. Check delivery in Waaru. Consent, template approval, service-window, quality and human-ownership checks apply to every send.

```js
import { WaaruApiError, WaaruConnectionError } from '@waaru/sdk';

try {
  await waaru.messages.sendText({ to: '+14155552671', text: 'Hello' });
} catch (error) {
  if ((error instanceof WaaruApiError || error instanceof WaaruConnectionError)
      && error.outcomeUnknown) {
    // Do not resend automatically. Reconcile in Waaru or contact support.
    console.error({ type: error.name, requestId: error.requestId });
  } else if (error instanceof WaaruApiError) {
    console.error(error.code, error.status, error.requestId);
  } else {
    throw error;
  }
}
```

The SDK never retries any request automatically. A timeout or lost response can leave a write outcome unknown. Request IDs do not prevent duplicate sends. For a deliberate send retry, reuse the identical body and the persisted `idempotencyKey`; never generate a replacement key to bypass a conflict.

Gateway errors, HTTP 408, all HTTP 5xx responses, and malformed error envelopes are conservatively marked `outcomeUnknown: true`. A recognized JSON 4xx response (except 408) has `false`; this is not permission to retry unchanged. `Retry-After` is guidance for pacing, not an automatic retry instruction. See [troubleshooting](TROUBLESHOOTING.md).

Optional constructor settings: `apiKey`, `timeoutMs` (default 30 seconds), trusted `baseUrl`, and `fetch`. Per-call options are `{ signal, timeoutMs, requestId }`; send methods additionally accept `idempotencyKey`. `.env` is loaded by Node's `--env-file` flag or your framework; the SDK reads the resulting environment variables.

## Developer API resources

The SDK includes:

- `messages.send/get`, `conversations.list/messages`, and `media.download`;
- `contacts`, `labels`, and static `segments` namespaces with workspace-wide scoped access;
- `templates.list/get` and `reports.activity`;
- revisioned `webhooks` management and local `verifyWebhook`.

See the complete [method/scope matrix](docs/api-coverage.md), [contact sync recipe](docs/recipes/contact-sync.md), and [durable webhook receiver](docs/recipes/webhook-receiver.md). Media downloads return a streaming `Response`; consume or cancel the body. Contact projections are not lossless exports. Webhook secrets are returned only on creation/rotation and cannot be recovered automatically.

No database, build step, or runtime dependencies are needed. For repository development: `npm ci && npm run verify`.

## Package trust

Every pull request is tested on the supported Node.js versions and against the packed npm artifact. After CI passes on `main`, new versions marked ready in `.github/release-policy.json` publish automatically through npm Trusted Publishing. Existing versions are skipped. Prereleases use the `beta` tag; stable releases use `latest`. npm provenance links published package bytes to the public source and workflow.

To prepare a release, update `package.json` and `package-lock.json` to the new version, update the changelog, and set the same version with `ready: true` in `.github/release-policy.json` after backend compatibility checks. Merge that release PR after required CI passes, then have the repository owner approve the `npm` environment job in GitHub Actions. Publication follows successful CI for the current `main` commit. Tags and GitHub Releases do not independently trigger publication. No reusable npm write token is needed.

The npm trusted publisher must specify organization `narayananexus`, repository `waaru`, workflow `publish.yml`, environment `npm`, and allow direct publishing. Leave a candidate at `ready: false` until its compatibility checks are complete. The workflow skips already published versions and records source and artifact integrity in its release summary.

## Contributing

Bug reports and narrowly scoped SDK improvements are welcome through [GitHub Issues](https://github.com/narayananexus/waaru/issues). Never include API keys, access tokens, customer phone numbers, message contents, or other customer data in an issue, log, or reproduction.

## Security

Do not report suspected vulnerabilities in a public issue. Follow the [security policy](SECURITY.md) for private reporting and safe reproduction guidance.

## License

This SDK is licensed under the [MIT License](LICENSE), copyright Narayana Nexus. This license covers the SDK and its accompanying documentation only, not the separately maintained Waaru platform, backend, dashboard, or hosted service. API access remains subject to Waaru's service terms and server-side controls.
