# Runnable template recipes

These examples call real sends when run from the terminal. Use only an authorized test recipient and your own approved templates. The automated tests inject a mock transport; no provider request is made by `npm test`.

From the repository, or after copying `template-recipes.mjs` into a project with `@waaru/sdk` installed, create a server-only `.env`:

```dotenv
WAARU_API_KEY=wak_your_actual_key
WAARU_TO=+14155552671
WAARU_TEMPLATE_NAME=your_approved_template
WAARU_TEMPLATE_LANGUAGE=en_US
```

Run one recipe:

```sh
node --env-file=.env examples/template-recipes.mjs no-variables
```

If you copied the file directly into your project root, omit `examples/` from the command. Do not commit the `.env` file.

| Recipe argument | Additional environment values | Required approved-template shape |
| --- | --- | --- |
| `no-variables` | None | No dynamic variables |
| `positional` | `WAARU_TEMPLATE_VALUE` | Exactly one positional body variable |
| `named` | `WAARU_TEMPLATE_VALUE`, `WAARU_TEMPLATE_PARAMETER_NAME` | Exactly one named body variable with that name |
| `image-header` | `WAARU_TEMPLATE_MEDIA_URL` | Image header, no dynamic body/button variables |
| `document-header` | `WAARU_TEMPLATE_MEDIA_URL` | Document header, no dynamic body/button variables |
| `url-button` | `WAARU_TEMPLATE_VALUE` | One dynamic URL button at index 0, no dynamic body/header variables |

For a URL button, supply the dynamic value/suffix expected by the approved template, not an arbitrary replacement URL. For media, use a real public HTTPS file compatible with the approved header. To combine header/body/button components, adapt the source to the exact approved template; the single-component recipes are intentionally minimal.

The SDK does not create, list, approve or modify templates. Quick-reply payload and coupon-code parameter variants are not implemented. Accepted `queued` output is not a delivery receipt. Refer to [troubleshooting](../TROUBLESHOOTING.md) before responding to failures; never retry sends blindly.
