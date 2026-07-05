# exiftool-arg-diff

Diff old/new metadata into the minimal `exiftool` CLI args needed to apply
the change. Compute-only: this library doesn't spawn `exiftool` itself, and
never invokes it when nothing changed.

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
};

const oldMetadata = { Description: "Sunset", Keywords: ["beach", "sunset"] };
const newMetadata = {
  Description: "Sunset over the bay",
  Keywords: ["beach", "dusk"],
};

diffMetadataArgs(schema, oldMetadata, newMetadata);
// => ["-Description=Sunset over the bay", "-Keywords+=dusk", "-Keywords-=sunset"]
```

If nothing changed, `diffMetadataArgs` returns `null` instead of `[]`, so
callers can skip running `exiftool` entirely.

## API

### `diffMetadataArgs(schema, oldMetadata, newMetadata)`

Diffs `oldMetadata` against `newMetadata` per `schema` and returns the
`exiftool` CLI args needed to apply the change, or `null` if nothing changed.
Fields not present in `schema` are ignored.

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

`Record<string, MetadataValue | MetadataValue[] | undefined>`. Scalar
fields hold a single value, list fields hold an array, and a
missing/undefined value means the tag is absent.

### `MetadataValue`

`string | number`, a scalar `exiftool` tag value.

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
