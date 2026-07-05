/** A scalar exiftool tag value. */
export type MetadataValue = string | number;

/** A field's value: a scalar, a list, or absent. */
type FieldValue = MetadataValue | MetadataValue[] | undefined;

/**
 * Metadata keyed by exiftool tag name. Scalar fields hold a single value;
 * list fields hold an array. A missing/undefined value means the tag is
 * absent.
 */
export type Metadata = Record<string, FieldValue>;

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

type StrategyDiffer = (
  field: string,
  oldValue: FieldValue,
  newValue: FieldValue,
) => string[];

/** Diffing logic per strategy. Keyed by `FieldStrategy` so adding a new strategy forces adding its differ here. */
const strategyDiffers: Record<FieldStrategy, StrategyDiffer> = {
  overwrite: diffOverwrite,
  "additive-list": diffAdditiveList,
  "list-overwrite": diffListOverwrite,
};

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
    const differ = strategyDiffers[strategy];
    args.push(...differ(field, oldMetadata[field], newMetadata[field]));
  }

  return args.length > 0 ? args : null;
}

function diffOverwrite(
  field: string,
  oldValue: FieldValue,
  newValue: FieldValue,
): string[] {
  if (oldValue === newValue) {
    return [];
  }
  return [newValue === undefined ? `-${field}=` : `-${field}=${newValue}`];
}

function toList(value: FieldValue): MetadataValue[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

/** Items present only in `oldList` (`removed`) or only in `newList` (`added`), as multisets (order-independent). */
function multisetDiff(
  oldList: MetadataValue[],
  newList: MetadataValue[],
): { added: MetadataValue[]; removed: MetadataValue[] } {
  const removed = [...oldList];
  const added: MetadataValue[] = [];

  for (const item of newList) {
    const index = removed.indexOf(item);
    if (index === -1) {
      added.push(item);
    } else {
      removed.splice(index, 1);
    }
  }

  return { added, removed };
}

function diffAdditiveList(
  field: string,
  oldValue: FieldValue,
  newValue: FieldValue,
): string[] {
  const { added, removed } = multisetDiff(toList(oldValue), toList(newValue));

  return [
    ...added.map((item) => `-${field}+=${item}`),
    ...removed.map((item) => `-${field}-=${item}`),
  ];
}

function diffListOverwrite(
  field: string,
  oldValue: FieldValue,
  newValue: FieldValue,
): string[] {
  const newList = toList(newValue);
  const { added, removed } = multisetDiff(toList(oldValue), newList);

  if (added.length === 0 && removed.length === 0) {
    return [];
  }
  return [`-${field}=${newList.join(",")}`];
}
