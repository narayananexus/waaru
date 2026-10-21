import { WaaruApiError } from '../src/index.js';

const failure = () => new Error('Compatibility check failed: contact_restoration; expected lifecycle fields and missing-resource rejection.');

async function requireMissing(invoke) {
  try {
    await invoke();
  } catch (error) {
    if (error instanceof WaaruApiError && error.status === 404 && error.code === 'contact_not_found') return;
  }
  throw failure();
}

export async function verifyContactRestoration(client, contactId, missingId) {
  // A representative existing contact is required to verify response fields.
  // Only the explicitly confirmed missing ID is ever used in the PATCH below.
  if (typeof contactId !== 'string' || !contactId || contactId === missingId) throw failure();
  const { contact } = await client.contacts.get(contactId, { includeArchived: true });
  if (!Number.isSafeInteger(contact.revision) || contact.revision < 0 ||
      !(contact.archivedAt === null ||
        (typeof contact.archivedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(contact.archivedAt) && Number.isFinite(Date.parse(contact.archivedAt))))) {
    throw failure();
  }
  await requireMissing(() => client.contacts.get(missingId, { includeArchived: true }));
  await requireMissing(() => client.contacts.update(missingId, { restoreArchived: true, expectedRevision: 0 }));
  // Safe receipts only: never include the contact ID, profile, or lifecycle value.
  return [
    { capability: 'contact_archived_lookup', result: 'read_ok' },
    { capability: 'contact_restore_validation', result: 'expected_rejection', status: 404, code: 'contact_not_found' },
  ];
}
