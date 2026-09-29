import { Waaru } from '@waaru/sdk';
if (!process.env.RECIPIENT_PHONE || !process.env.WAARU_IDEMPOTENCY_KEY) throw new Error('Set RECIPIENT_PHONE and a persisted WAARU_IDEMPOTENCY_KEY for this logical send.');
const result = await new Waaru().messages.sendText(
  { to: process.env.RECIPIENT_PHONE, text: process.env.MESSAGE_TEXT ?? 'Hello from Waaru.' },
  { idempotencyKey: process.env.WAARU_IDEMPOTENCY_KEY },
);
console.log(result.messageId, result.status);
