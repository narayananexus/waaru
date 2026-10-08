import { check, object, string, mediaLink } from './validation.js';

function array(value, min, max, label) {
  check(Array.isArray(value) && value.length >= min && value.length <= max, `${label} has an invalid item count.`);
}
function optionalText(value, max, label) {
  if (value !== undefined) check(typeof value === 'string' && value.trim().length <= max, `${label} is invalid.`);
}
function parameter(p, trim = false) {
  const named = ['text', 'currency', 'date_time'].includes(p?.type);
  object(p, named ? ['type', p.type, 'parameter_name'] : ['type', p?.type], 'Template parameter');
  const normalized = (value) => trim && typeof value === 'string' ? value.trim() : value;
  if (p.parameter_name !== undefined) string(normalized(p.parameter_name), 128, 'Parameter name');
  if (p.type === 'text') string(normalized(p.text), 1024, 'Parameter text');
  else if (p.type === 'currency') {
    object(p.currency, ['fallback_value', 'code', 'amount_1000'], 'Currency');
    string(normalized(p.currency.fallback_value), 1024, 'Currency fallback');
    check(typeof p.currency.code === 'string' && p.currency.code.length === 3, 'Currency code must have three characters.');
    check(Number.isInteger(p.currency.amount_1000), 'Currency amount must be an integer.');
  } else if (p.type === 'date_time') {
    object(p.date_time, ['fallback_value'], 'Date/time');
    string(normalized(p.date_time.fallback_value), 1024, 'Date/time fallback');
  } else if (['image', 'video', 'document'].includes(p.type)) {
    object(p[p.type], p.type === 'document' ? ['link', 'filename'] : ['link'], 'Media parameter');
    mediaLink(p[p.type].link);
    if (p.type === 'document' && p.document.filename !== undefined) string(p.document.filename, 240, 'Filename');
  } else if (p.type === 'location') {
    object(p.location, ['latitude', 'longitude', 'name', 'address'], 'Location parameter');
    for (const [key, max] of [['latitude', 90], ['longitude', 180]]) {
      const value = p.location[key];
      check((typeof value === 'number' || (typeof value === 'string' && /^-?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value))) && Number.isFinite(Number(value)) && Math.abs(Number(value)) <= max, `Location ${key} is invalid.`);
    }
    optionalText(p.location.name, 1000, 'Location name');
    optionalText(p.location.address, 1000, 'Location address');
  } else if (p.type === 'limited_time_offer') {
    object(p.limited_time_offer, ['expiration_time_ms'], 'Offer parameter');
    const value = p.limited_time_offer.expiration_time_ms;
    check(Number.isInteger(value) && value > 0 && value <= 8640000000000000, 'Offer expiration is invalid.');
  } else if (p.type === 'coupon_code') {
    check(typeof p.coupon_code === 'string' && p.coupon_code.trim().length >= 1 && p.coupon_code.trim().length <= 20, 'Coupon code is invalid.');
  } else if (p.type === 'action') {
    object(p.action, ['flow_token'], 'Flow action');
    check(typeof p.action.flow_token === 'string' && /^[A-Za-z0-9_-]{1,128}$/u.test(p.action.flow_token) && !p.action.flow_token.startsWith('wfl1_'), 'Managed Form tokens are assigned by Waaru.');
  } else check(false, 'Unsupported template parameter type.');
}
function carousel(component) {
  object(component, ['type', 'cards'], 'Carousel');
  array(component.cards, 2, 10, 'Carousel cards');
  for (const card of component.cards) {
    object(card, ['card_index', 'components'], 'Carousel card');
    check(Number.isInteger(card.card_index) && card.card_index >= 0 && card.card_index <= 9, 'Carousel card index is invalid.');
    array(card.components, 1, 4, 'Carousel card components');
    for (const c of card.components) {
      object(c, c?.type === 'button' ? ['type', 'sub_type', 'index', 'parameters'] : ['type', 'parameters'], 'Carousel card component');
      if (c.type === 'header') {
        array(c.parameters, 1, 1, 'Carousel header parameters');
        const p = c.parameters[0];
        object(p, ['type', p?.type], 'Carousel header');
        if (p.type === 'image' || p.type === 'video') {
          const media = p[p.type];
          object(media, media?.id === undefined ? ['link'] : ['id'], 'Carousel media');
          if (media.id === undefined) mediaLink(media.link);
          else check(typeof media.id === 'string' && media.id.trim().length > 0 && media.id.trim().length <= 256, 'Carousel media ID is invalid.');
        } else if (p.type === 'product') {
          object(p.product, ['catalog_id', 'product_retailer_id'], 'Carousel product');
          for (const [key, max] of [['catalog_id', 128], ['product_retailer_id', 256]]) check(typeof p.product[key] === 'string' && p.product[key].trim().length > 0 && p.product[key].trim().length <= max, 'Carousel product ID is invalid.');
        } else check(false, 'Unsupported carousel header.');
      } else if (c.type === 'body') {
        array(c.parameters, 1, 100, 'Carousel body parameters');
        for (const p of c.parameters) {
          check(['text', 'currency', 'date_time'].includes(p?.type), 'Unsupported carousel body parameter.');
          parameter(p, true);
          const text = p.type === 'text' ? p.text : p[p.type].fallback_value;
          check(text.trim().length > 0 && (p.parameter_name === undefined || p.parameter_name.trim().length > 0), 'Carousel text cannot be empty.');
        }
      } else if (c.type === 'button') {
        check(['url', 'quick_reply'].includes(c.sub_type), 'Unsupported carousel button.');
        check([0, 1, '0', '1'].includes(c.index), 'Carousel button index is invalid.');
        array(c.parameters, 1, 1, 'Carousel button parameters');
        const p = c.parameters[0], key = c.sub_type === 'url' ? 'text' : 'payload';
        object(p, ['type', key], 'Carousel button parameter');
        check(p.type === key && typeof p[key] === 'string' && p[key].trim().length > 0 && p[key].trim().length <= (key === 'text' ? 1024 : 256), 'Carousel button parameter is invalid.');
      } else check(false, 'Unsupported carousel component.');
    }
  }
}
export function validateFlowLaunch(value) {
  object(value, ['buttonIndex', 'contractHash', 'inputs'], 'Form launch');
  check(Number.isInteger(value.buttonIndex) && value.buttonIndex >= 0 && value.buttonIndex <= 9, 'Form button index is invalid.');
  check(typeof value.contractHash === 'string' && /^[a-f0-9]{64}$/u.test(value.contractHash), 'Form contract hash is invalid.');
  if (value.inputs === undefined) return;
  const inputs = value.inputs;
  check(inputs !== null && typeof inputs === 'object' && !Array.isArray(inputs), 'Form inputs must be an object.');
  const entries = Object.entries(inputs);
  check(entries.length <= 30, 'Form supports at most 30 inputs.');
  for (const [key, item] of entries) {
    check(/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key) && !['__proto__', 'prototype', 'constructor', 'flow_token', 'flow_action', 'flow_action_payload'].includes(key), 'Form input name is invalid.');
    check((typeof item === 'string' && item.length <= 4096) || (typeof item === 'number' && Number.isFinite(item)) || typeof item === 'boolean' || (Array.isArray(item) && item.length <= 50 && item.every(x => typeof x === 'string' && x.length <= 4096)), 'Form input value is invalid.');
  }
  check(Buffer.byteLength(JSON.stringify(inputs)) <= 32768, 'Form inputs exceed the 32 KiB limit.');
}
export function validateTemplate(input) {
  string(input.name, 512, 'Template name');
  string(input.language, 32, 'Template language');
  if (input.templateFlowLaunch !== undefined) validateFlowLaunch(input.templateFlowLaunch);
  if (input.media_assets !== undefined) {
    array(input.media_assets, 1, 10, 'Carousel media bindings');
    const indexes = new Set();
    for (const binding of input.media_assets) {
      object(binding, ['card_index', 'asset_id'], 'Carousel media binding');
      check(Number.isInteger(binding.card_index) && binding.card_index >= 0 && binding.card_index <= 9 && !indexes.has(binding.card_index), 'Carousel binding index is invalid or repeated.');
      indexes.add(binding.card_index);
      check(typeof binding.asset_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(binding.asset_id), 'Carousel binding asset ID must be a UUID.');
    }
  }
  if (input.components === undefined) return;
  array(input.components, 0, 100, 'Template components');
  for (const c of input.components) {
    check(c !== null && typeof c === 'object', 'Invalid template component.');
    if (c.type === 'carousel') { carousel(c); continue; }
    object(c, ['type', 'sub_type', 'index', 'parameters'], 'Template component');
    check(['header', 'body', 'button', 'limited_time_offer'].includes(c.type), 'Invalid component type.');
    if (c.sub_type !== undefined) check(['quick_reply', 'url', 'copy_code', 'flow'].includes(c.sub_type), 'Invalid button subtype.');
    if (c.index !== undefined) check(typeof c.index === 'string' && /^\d{1,2}$/u.test(c.index), 'Button index must be a one- or two-digit string.');
    array(c.parameters, 0, 100, 'Component parameters');
    for (const p of c.parameters) parameter(p);
  }
}
