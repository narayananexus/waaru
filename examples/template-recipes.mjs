import { pathToFileURL } from 'node:url';
import { Waaru, WaaruApiError, WaaruConnectionError } from '@waaru/sdk';

// Each recipe must match an actual approved template. These are shape examples,
// not pre-approved templates or proof of provider delivery.
export async function sendRecipe(client, recipe, values) {
  const body = parameter => [{ type: 'body', parameters: [parameter] }];
  const components = {
    'no-variables': undefined,
    positional: body({ type: 'text', text: values.value }),
    named: body({ type: 'text', text: values.value, parameter_name: values.parameterName }),
    'image-header': [{ type: 'header', parameters: [{ type: 'image', image: { link: values.mediaUrl } }] }],
    'document-header': [{ type: 'header', parameters: [{ type: 'document', document: { link: values.mediaUrl } }] }],
    'url-button': [{ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: values.value }] }],
  };
  if (!Object.hasOwn(components, recipe)) throw new Error('Unknown recipe. See examples/README.md.');
  return client.messages.sendTemplate({
    to: values.to, name: values.name, language: values.language,
    ...(components[recipe] === undefined ? {} : { components: components[recipe] }),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await sendRecipe(new Waaru(), process.argv[2] ?? 'no-variables', {
      to: process.env.WAARU_TO,
      name: process.env.WAARU_TEMPLATE_NAME,
      language: process.env.WAARU_TEMPLATE_LANGUAGE,
      value: process.env.WAARU_TEMPLATE_VALUE,
      parameterName: process.env.WAARU_TEMPLATE_PARAMETER_NAME,
      mediaUrl: process.env.WAARU_TEMPLATE_MEDIA_URL,
    });
    console.log({ messageId: result.messageId, status: result.status, requestId: result.requestId });
  } catch (error) {
    if (error instanceof WaaruApiError || error instanceof WaaruConnectionError) {
      console.error({ type: error.name, status: error.status, code: error.code,
        requestId: error.requestId, outcomeUnknown: error.outcomeUnknown });
    } else {
      console.error('Check recipe arguments and environment values. No automatic retry was made.');
    }
    process.exitCode = 1;
  }
}
