# exiftool-arg-diff

Diff old/new metadata into the minimal `exiftool` CLI args needed to apply
the change. Compute-only: this library never spawns `exiftool` itself, and
never invokes it when nothing changed.

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

const oldMetadata = { Description: "Sunset", Keywords: ["beach"] };
const newMetadata = {
  Description: "Sunset over the bay",
  Keywords: ["beach", "dusk"],
};

diffMetadataArgs(schema, oldMetadata, newMetadata);
// => ["-Description=Sunset over the bay", "-Keywords+=dusk"]
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

### `Metadata`

`Record<string, MetadataValue | MetadataValue[] | undefined>`. Scalar
fields hold a single value, list fields hold an array, and a
missing/undefined value means the tag is absent.

### `MetadataValue`

`string | number`, a scalar `exiftool` tag value.

## Integrating with exiftool-vendored

This library only computes args; it's a natural companion to
[`exiftool-vendored`](https://github.com/photostructure/exiftool-vendored.js),
which runs `exiftool` for you. Pass the computed args as `write()`'s third
argument, and skip the call entirely when there's nothing to do:

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
  if (args === null) {
    return;
  }
  await exiftool.write(file, {}, args);
}
```
