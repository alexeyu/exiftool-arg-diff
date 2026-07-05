/** A scalar exiftool tag value. */
export type MetadataValue = string | number;

/** Metadata keyed by exiftool tag name. A missing/undefined value means the tag is absent. */
export type Metadata = Record<string, MetadataValue | undefined>;

/**
 * How a field's changes should be translated into exiftool args.
 * Only "overwrite" is implemented so far; "additive-list" and
 * "list-overwrite" are added in M2.
 */
export type FieldStrategy = "overwrite";

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

  for (const field of Object.keys(schema)) {
    const oldValue = oldMetadata[field];
    const newValue = newMetadata[field];
    if (oldValue === newValue) {
      continue;
    }
    args.push(newValue === undefined ? `-${field}=` : `-${field}=${newValue}`);
  }

  return args.length > 0 ? args : null;
}
