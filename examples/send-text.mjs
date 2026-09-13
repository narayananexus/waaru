import { Waaru } from '@waaru/sdk';
if (!process.env.RECIPIENT_PHONE) throw new Error('Set RECIPIENT_PHONE to the intended recipient in +E.164 format.');
const result = await new Waaru().messages.sendText({ to: process.env.RECIPIENT_PHONE, text: process.env.MESSAGE_TEXT ?? 'Hello from Waaru.' });
console.log(result.messageId, result.status);
