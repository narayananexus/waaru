import { Waaru } from '@waaru/sdk';
if (!process.env.RECIPIENT_PHONE || !process.env.TEMPLATE_NAME || !process.env.TEMPLATE_LANGUAGE) throw new Error('Set RECIPIENT_PHONE, TEMPLATE_NAME and TEMPLATE_LANGUAGE.');
const result = await new Waaru().messages.sendTemplate({ to: process.env.RECIPIENT_PHONE, name: process.env.TEMPLATE_NAME, language: process.env.TEMPLATE_LANGUAGE });
console.log(result.messageId, result.status);
