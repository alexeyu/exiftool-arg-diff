/** A scalar exiftool tag value. */
export type MetadataValue = string | number;

/**
 * Metadata keyed by exiftool tag name. Scalar fields hold a single value;
 * list fields hold an array. A missing/undefined value means the tag is
 * absent.
 */
export type Metadata = Record<
  string,
  MetadataValue | MetadataValue[] | undefined
>;

/**
 * How a field's changes should be translated into exiftool args.
 * - `overwrite`: scalar field, replaced wholesale (`-field=value`).
 * - `additive-list`: list field with incremental add/remove support
 *   (`-field+=x`, `-field-=y`), diffed as a multiset (order-independent).
 * - `list-overwrite`: list field without incremental support, replaced
 *   wholesale (`-field=a,b,c`) whenever its multiset of values changes.
 */
export type FieldStrategy = "overwrite" | "additive-list" | "list-overwrite";

/** Per-field strategy declarations, keyed by exiftool tag name. */
export type MetadataSchema = Record<string, FieldStrategy>;

/**
 * Diffs old vs new metadata per the given schema and returns the minimal
 * exiftool CLI args needed to apply the change, or `null` if nothing changed.
 */
export function diffMetadataArgs(
  schema: MetadataSchema,
  oldMetadata: Metadata,
  newMetadata: Metadata,
): string[] | null {
  const args: string[] = [];

  for (const [field, strategy] of Object.entries(schema)) {
    const oldValue = oldMetadata[field];
    const newValue = newMetadata[field];

    switch (strategy) {
      case "overwrite":
        args.push(...diffOverwrite(field, oldValue, newValue));
        break;
      case "additive-list":
        args.push(...diffAdditiveList(field, oldValue, newValue));
        break;
      case "list-overwrite":
        args.push(...diffListOverwrite(field, oldValue, newValue));
        break;
    }
  }

  return args.length > 0 ? args : null;
}

function diffOverwrite(
  field: string,
  oldValue: MetadataValue | MetadataValue[] | undefined,
  newValue: MetadataValue | MetadataValue[] | undefined,
): string[] {
  if (oldValue === newValue) {
    return [];
  }
  return [newValue === undefined ? `-${field}=` : `-${field}=${newValue}`];
}

function toList(
  value: MetadataValue | MetadataValue[] | undefined,
): MetadataValue[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Removes one occurrence of `item` from `remaining`, if present. Returns whether it was found. */
function removeOne(remaining: MetadataValue[], item: MetadataValue): boolean {
  const index = remaining.indexOf(item);
  if (index === -1) {
    return false;
  }
  remaining.splice(index, 1);
  return true;
}

function diffAdditiveList(
  field: string,
  oldValue: MetadataValue | MetadataValue[] | undefined,
  newValue: MetadataValue | MetadataValue[] | undefined,
): string[] {
  const remaining = [...toList(oldValue)];
  const added: MetadataValue[] = [];

  for (const item of toList(newValue)) {
    if (!removeOne(remaining, item)) {
      added.push(item);
    }
  }
  const removed = remaining;

  return [
    ...added.map((item) => `-${field}+=${item}`),
    ...removed.map((item) => `-${field}-=${item}`),
  ];
}

function isSameMultiset(a: MetadataValue[], b: MetadataValue[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const remaining = [...a];
  return b.every((item) => removeOne(remaining, item));
}

function diffListOverwrite(
  field: string,
  oldValue: MetadataValue | MetadataValue[] | undefined,
  newValue: MetadataValue | MetadataValue[] | undefined,
): string[] {
  const oldList = toList(oldValue);
  const newList = toList(newValue);

  if (isSameMultiset(oldList, newList)) {
    return [];
  }
  return [`-${field}=${newList.join(",")}`];
}
