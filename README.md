# exiftool-arg-diff

[![npm version](https://img.shields.io/npm/v/exiftool-arg-diff.svg)](https://www.npmjs.com/package/exiftool-arg-diff)

Your app reads a file's metadata, the user edits two fields, and you write
the result. Write the whole record and you push eleven unchanged tags back
to disk, along with whatever another tool changed while you were holding the
data.

`diffMetadataArgs` takes what you read and what you now want, and returns
the `exiftool` args that apply the difference. When nothing changed it
returns `null`, so you skip the subprocess.

## When this helps

You hold metadata in memory between reading a file and writing it: an
editor, a tagging UI, a sync job, anything with a model the user edits.
`exiftool` has no memory of what you read ten minutes ago, so it cannot
separate your edit from one another tool made in the meantime. Your app
knows both, and this turns that into the smallest correct write.

- List fields diff as multisets, so `Keywords` emits `-Keywords+=added` and
  `-Keywords-=removed` instead of replacing the list. Keywords a different
  tool added survive.
- Unchanged fields produce no args, and an unchanged record produces no call.
- Zero runtime dependencies. It computes strings, and you keep whatever
  already runs `exiftool` (`exiftool-vendored`, a raw `child_process` call).

The payoff scales with how long you hold the data. A tagging UI left open
for an hour has an hour of drift to guard against. A script that reads and
writes in the same breath has almost none, and plain `exiftool` will serve
it better.

## Install

```sh
npm install exiftool-arg-diff
```

## Usage

Declare a strategy per field, then diff old vs new metadata:

```ts
import { diffMetadataArgs, type MetadataSchema } from "exiftool-arg-diff";

const schema: MetadataSchema = {
  Description: "overwrite",
  Keywords: "additive-list",
  Rating: "overwrite",
};

const oldMetadata = { Description: "Sunset", Keywords: ["beach", "sunset"] };
const newMetadata = {
  Description: "Sunset over the bay",
  Keywords: ["beach", "dusk"],
  Rating: 5, // absent from oldMetadata: diffed as newly set, not skipped
};

diffMetadataArgs(schema, oldMetadata, newMetadata);
// => ["-Description=Sunset over the bay", "-Keywords+=dusk", "-Keywords-=sunset", "-Rating=5"]
```

If nothing changed, `diffMetadataArgs` returns `null` instead of `[]`, so
callers can skip running `exiftool` entirely.

## API

### `diffMetadataArgs(schema, oldMetadata, newMetadata)`

Diffs `oldMetadata` against `newMetadata` per `schema` and returns the
`exiftool` CLI args needed to apply the change, or `null` if nothing changed.
Fields not present in `schema` are ignored. A field missing from
`oldMetadata` or `newMetadata` is treated as `undefined` (tag absent), not
skipped, so e.g. a field present only in `newMetadata` is diffed as newly
added.

### `MetadataSchema`

`Record<string, FieldStrategy>`, keyed by `exiftool` tag name.

### `FieldStrategy`

How a field's changes are translated into args:

- `"overwrite"`: scalar field, replaced wholesale (`-field=value`). A field
  removed in `newMetadata` clears it (`-field=`).
- `"additive-list"`: list field with incremental add/remove support
  (`-field+=x`, `-field-=y`), diffed as a multiset (order-independent). Use
  this for fields like `Keywords` on formats that support incremental list
  edits (e.g. JPEG/IPTC).
- `"list-overwrite"`: list field without incremental support, replaced
  wholesale (`-field=a,b,c`) whenever its multiset of values changes. Use
  this for containers that don't support incremental list edits (e.g. video).

Don't use `"overwrite"` on a list field: it compares with `===` (reference
equality), so it fires on every diff regardless of order or actual change.
Use `"additive-list"` or `"list-overwrite"` for array-valued fields.

### `Metadata`

`Record<string, FieldValue>`. Scalar fields hold a single value, list fields
hold an array, and a missing/undefined value means the tag is absent.

### `FieldValue`

`MetadataValue | MetadataValue[] | undefined`, one field's value.

### `MetadataValue`

`string | number`, a scalar `exiftool` tag value.

## Example schema

There's no shipped default schema: which strategy fits a field depends on
your workflow. Here's a starting point for photo metadata to copy and adjust:

```ts
const photoSchema: MetadataSchema = {
  Title: "overwrite",
  Description: "overwrite",
  Rating: "overwrite",
  GPSLatitude: "overwrite",
  GPSLongitude: "overwrite",
  Keywords: "additive-list", // JPEG/IPTC keywords support incremental edits
  Subject: "additive-list",
};
```

## Composing with photo-metadata-replicate

Diffing needs a new metadata state to compare against. To build one, pair
this with
[`photo-metadata-replicate`](https://www.npmjs.com/package/photo-metadata-replicate),
which merges one item's metadata onto a set of targets in memory: keywords
union, and an empty source field never blanks a target.

Its metadata shape matches this package's, so a merged result goes straight
into `diffMetadataArgs`. Replicate to get the new metadata, then diff it
against the original for the args to run.

## Integrating with exiftool-vendored

This library only computes args; it's a natural companion to
[`exiftool-vendored`](https://github.com/photostructure/exiftool-vendored.js),
which runs `exiftool` for you. Pass the computed args as `write()`'s
`writeArgs` option, and skip the call entirely when there's nothing to do:

```ts
import { exiftool } from "exiftool-vendored";
import {
  diffMetadataArgs,
  type Metadata,
  type MetadataSchema,
} from "exiftool-arg-diff";

const schema: MetadataSchema = { Description: "overwrite" };

async function applyMetadataChange(
  file: string,
  oldMetadata: Metadata,
  newMetadata: Metadata,
): Promise<void> {
  const args = diffMetadataArgs(schema, oldMetadata, newMetadata);
  if (args !== null) {
    await exiftool.write(file, {}, { writeArgs: args });
  }
}
```
