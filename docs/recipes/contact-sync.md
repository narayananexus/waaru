# Contact sync recipe

Contact and label scopes are workspace-wide. Use a key whose connected number is in `EXTERNAL_API` mode and grant only the exact read/write scopes needed.

```js
import { Waaru } from '@waaru/sdk';

const waaru = new Waaru();

// Register active source (STRING) and priority (NUMBER) custom fields in Waaru first.
const { contact } = await waaru.contacts.upsert({
  phoneE164: '+14155552671',
  firstName: 'Ada',
  customAttributes: { source: 'crm', priority: 2 },
});

await waaru.contacts.applyLabel(contact.id, 'label-fixture');

let after;
do {
  const page = await waaru.contacts.list({
    limit: 50,
    after,
    updatedSince: '2026-09-29T00:00:00Z',
  });
  for (const item of page.items) {
    // Reconcile by stable contact ID. optedOut is read-only.
    console.log(item.id, item.updatedAt, item.optedOut);
  }
  after = page.nextCursor ?? undefined;
} while (after);
```

Keep filters fixed while paging. Pages are live, not snapshots, and timestamp filtering is not a deletion feed. Read projections retain only supported scalar custom attributes and may omit/truncate stored data; never use them as a lossless backup or send the projection back as a complete replacement. The URL supplies contact ID on update; `phoneE164`, consent, opt-out/restriction state and deletion state are not patchable.

This recipe requires `1.0.0-beta.3` or later. Install with `npm install @waaru/sdk@beta` and use the scopes listed in [API coverage](../api-coverage.md).

Custom attributes merge into the registered catalog; unknown or archived fields and type mismatches fail with `invalid_custom_attributes`. Null is not an attribute-removal instruction. CSV import remains a governed dashboard operation; the SDK exposes individual upserts only.


## Explicit restoration (unpublished source)

An archived contact is excluded from ordinary detail/list calls, and upsert does not restore it. With the matching additive API deployed, deliberately review an exact archived record before restoring it:

```js
const { contact } = await client.contacts.get(contactId, { includeArchived: true });
if (typeof contact.archivedAt === "string") {
  if (typeof contact.revision !== "number") throw new Error("A reviewed lifecycle revision is required");
  await client.contacts.update(contact.id, {
    restoreArchived: true,
    expectedRevision: contact.revision,
    firstName: "Reviewed profile name",
  });
}
```

Use the lifecycle revision from that lookup; a stale archived revision rejects with `409 contact_archive_changed`. Review/reconcile the current record before deciding whether another write is appropriate. Restoration preserves opt-out, restrictions and retained history, and does not re-add removed segment memberships. It does not authorize sending messages. Lists remain active-only, and ordinary profile updates keep their earlier behavior.

This option is implemented only in unpublished SDK source. Published beta.4 rejects these new request fields locally, while retaining new response fields at runtime. Publication/version selection and matching deployed API acceptance require separate approval and evidence.
