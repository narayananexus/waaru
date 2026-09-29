import { Waaru } from '@waaru/sdk';
if (!process.env.RECIPIENT_PHONE || !process.env.TEMPLATE_NAME || !process.env.TEMPLATE_LANGUAGE || !process.env.WAARU_IDEMPOTENCY_KEY) throw new Error('Set RECIPIENT_PHONE, TEMPLATE_NAME, TEMPLATE_LANGUAGE and a persisted WAARU_IDEMPOTENCY_KEY.');
const result = await new Waaru().messages.sendTemplate(
  { to: process.env.RECIPIENT_PHONE, name: process.env.TEMPLATE_NAME, language: process.env.TEMPLATE_LANGUAGE },
  { idempotencyKey: process.env.WAARU_IDEMPOTENCY_KEY },
);
console.log(result.messageId, result.status);
