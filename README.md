# exiftool-arg-diff

[![npm version](https://img.shields.io/npm/v/exiftool-arg-diff.svg)](https://www.npmjs.com/package/exiftool-arg-diff)

Write the whole record on every save and you clobber the keywords another
tool added between your read and your write. This library computes the
minimal `exiftool` args to apply just what changed.

Compute-only: it never spawns `exiftool`, and returns `null` when nothing
changed so you can skip the call.

## Why exiftool-arg-diff?

- Writes only the fields that changed, not the whole record every save.
- Diffs list fields as sets (`additive-list`), so keywords added by other
  tools between reads aren't clobbered.
- Zero runtime dependencies: a thin compute-only layer to drop next to
  whatever runs `exiftool` for you (`exiftool-vendored`, a raw
  `child_process` call, etc.).

Not a fit for batch/`-stay_open` workflows (out of scope for now), or if
you're not diffing against a prior metadata state at all.

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
which copies one item's metadata onto a set of targets: keywords union, and
an empty source field never blanks a target.

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
