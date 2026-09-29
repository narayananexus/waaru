# Contact sync recipe

Contact and label scopes are workspace-wide. Use a key whose connected number is in `EXTERNAL_API` mode and grant only the exact read/write scopes needed.

```js
import { Waaru } from '@waaru/sdk';

const waaru = new Waaru();

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

Release note: this recipe describes the unreleased expansion. Backend verification and integration checks described in `api-coverage.md` are required before publication.
