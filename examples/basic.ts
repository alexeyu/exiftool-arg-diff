import { diffMetadataArgs, type MetadataSchema } from "../src/index.js";

const schema: MetadataSchema = {
  Description: "overwrite",
  Keywords: "additive-list",
};

const oldMetadata = { Description: "Sunset", Keywords: ["beach"] };
const newMetadata = {
  Description: "Sunset over the bay",
  Keywords: ["beach", "dusk"],
};

/** Mirrors the "Usage" snippet in the README. */
export function run(): string[] | null {
  return diffMetadataArgs(schema, oldMetadata, newMetadata);
}
