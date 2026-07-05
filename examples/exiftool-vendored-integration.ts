import { exiftool } from "exiftool-vendored";
import {
  diffMetadataArgs,
  type Metadata,
  type MetadataSchema,
} from "../src/index.js";

const schema: MetadataSchema = { Description: "overwrite" };

/**
 * Mirrors the "exiftool-vendored integration" snippet in the README: compute
 * the diff, and only call exiftool if something actually changed.
 */
export async function applyMetadataChange(
  file: string,
  oldMetadata: Metadata,
  newMetadata: Metadata,
): Promise<void> {
  const args = diffMetadataArgs(schema, oldMetadata, newMetadata);
  if (args !== null) {
    await exiftool.write(file, {}, { writeArgs: args });
  }
}
