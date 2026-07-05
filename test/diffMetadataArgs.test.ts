import { describe, expect, it } from "vitest";
import { diffMetadataArgs, type MetadataSchema } from "../src/index.js";

const schema: MetadataSchema = {
  Caption: "overwrite",
  Creator: "overwrite",
};

describe("diffMetadataArgs", () => {
  it("returns null when nothing changed", () => {
    const oldMetadata = { Caption: "a", Creator: "b" };
    const newMetadata = { Caption: "a", Creator: "b" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toBeNull();
  });

  it("returns null when both are empty", () => {
    expect(diffMetadataArgs(schema, {}, {})).toBeNull();
  });

  it("emits one -field=value arg per changed scalar field", () => {
    const oldMetadata = { Caption: "a", Creator: "b" };
    const newMetadata = { Caption: "a2", Creator: "b2" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toEqual([
      "-Caption=a2",
      "-Creator=b2",
    ]);
  });

  it("only emits args for fields that actually changed", () => {
    const oldMetadata = { Caption: "a", Creator: "b" };
    const newMetadata = { Caption: "a", Creator: "b2" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toEqual([
      "-Creator=b2",
    ]);
  });

  it("emits an arg for a field newly added in newMetadata", () => {
    const oldMetadata = { Caption: "a" };
    const newMetadata = { Caption: "a", Creator: "b" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toEqual([
      "-Creator=b",
    ]);
  });

  it("emits a clearing arg for a field removed (present in old, absent in new)", () => {
    const oldMetadata = { Caption: "a", Creator: "b" };
    const newMetadata = { Caption: "a" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toEqual([
      "-Creator=",
    ]);
  });

  it("handles numeric values", () => {
    const numericSchema: MetadataSchema = { Rating: "overwrite" };

    expect(
      diffMetadataArgs(numericSchema, { Rating: 3 }, { Rating: 5 }),
    ).toEqual(["-Rating=5"]);
  });

  it("ignores fields not declared in the schema", () => {
    const oldMetadata = { Caption: "a", Untracked: "x" };
    const newMetadata = { Caption: "a", Untracked: "y" };

    expect(diffMetadataArgs(schema, oldMetadata, newMetadata)).toBeNull();
  });
});
