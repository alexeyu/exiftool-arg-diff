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

describe("diffMetadataArgs (additive-list strategy)", () => {
  const listSchema: MetadataSchema = { Keywords: "additive-list" };

  it("returns null when the list is unchanged", () => {
    const oldMetadata = { Keywords: ["a", "b"] };
    const newMetadata = { Keywords: ["a", "b"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toBeNull();
  });

  it("is order-independent", () => {
    const oldMetadata = { Keywords: ["a", "b", "c"] };
    const newMetadata = { Keywords: ["c", "a", "b"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toBeNull();
  });

  it("emits += args for added-only items", () => {
    const oldMetadata = { Keywords: ["a"] };
    const newMetadata = { Keywords: ["a", "b", "c"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords+=b",
      "-Keywords+=c",
    ]);
  });

  it("emits -= args for removed-only items", () => {
    const oldMetadata = { Keywords: ["a", "b", "c"] };
    const newMetadata = { Keywords: ["a"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords-=b",
      "-Keywords-=c",
    ]);
  });

  it("emits both += and -= args when items are added and removed", () => {
    const oldMetadata = { Keywords: ["a", "b"] };
    const newMetadata = { Keywords: ["b", "c"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords+=c",
      "-Keywords-=a",
    ]);
  });

  it("treats an absent list as empty", () => {
    const oldMetadata = {};
    const newMetadata = { Keywords: ["a"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords+=a",
    ]);
  });

  it("emits -= for every item when the list is removed entirely", () => {
    const oldMetadata = { Keywords: ["a", "b"] };
    const newMetadata = {};

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords-=a",
      "-Keywords-=b",
    ]);
  });

  it("treats duplicates as a multiset: one fewer occurrence removed, not all", () => {
    const oldMetadata = { Keywords: ["a", "a"] };
    const newMetadata = { Keywords: ["a"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords-=a",
    ]);
  });

  it("treats duplicates as a multiset: one extra occurrence added, not zero", () => {
    const oldMetadata = { Keywords: ["a"] };
    const newMetadata = { Keywords: ["a", "a"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Keywords+=a",
    ]);
  });

  it("does not mutate the caller's oldMetadata list", () => {
    const oldMetadata = { Keywords: ["a", "b", "c"] };
    const newMetadata = { Keywords: ["a"] };

    diffMetadataArgs(listSchema, oldMetadata, newMetadata);

    expect(oldMetadata.Keywords).toEqual(["a", "b", "c"]);
  });
});

describe("diffMetadataArgs (list-overwrite strategy)", () => {
  const listSchema: MetadataSchema = { Cast: "list-overwrite" };

  it("returns null when the list is unchanged", () => {
    const oldMetadata = { Cast: ["Alice", "Bob"] };
    const newMetadata = { Cast: ["Alice", "Bob"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toBeNull();
  });

  it("returns null when only order differs", () => {
    const oldMetadata = { Cast: ["Alice", "Bob"] };
    const newMetadata = { Cast: ["Bob", "Alice"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toBeNull();
  });

  it("emits one overwrite arg when the set changed", () => {
    const oldMetadata = { Cast: ["Alice", "Bob"] };
    const newMetadata = { Cast: ["Alice", "Carol"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Cast=Alice,Carol",
    ]);
  });

  it("emits a clearing overwrite arg when the list is removed entirely", () => {
    const oldMetadata = { Cast: ["Alice", "Bob"] };
    const newMetadata = {};

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Cast=",
    ]);
  });

  it("treats a duplicate-count change as a set change", () => {
    const oldMetadata = { Cast: ["Alice", "Alice"] };
    const newMetadata = { Cast: ["Alice"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toEqual([
      "-Cast=Alice",
    ]);
  });

  it("returns null when duplicate counts match", () => {
    const oldMetadata = { Cast: ["Alice", "Alice"] };
    const newMetadata = { Cast: ["Alice", "Alice"] };

    expect(diffMetadataArgs(listSchema, oldMetadata, newMetadata)).toBeNull();
  });
});
