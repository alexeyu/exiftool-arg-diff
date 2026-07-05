import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exiftool } from "exiftool-vendored";
import { afterAll, describe, expect, it } from "vitest";
import { run as runBasicExample } from "../examples/basic.js";
import { applyMetadataChange } from "../examples/exiftool-vendored-integration.js";

// A minimal valid, empty XMP sidecar file (exiftool creates one from scratch
// for non-existent files, but exiftool-vendored's write() needs an existing
// file when writing raw args with no `tags`, so we seed one ourselves).
const MINIMAL_XMP = `<?xpacket begin='﻿' id='W5M0MpCehiHzreSzNTczkc9d'?>
<x:xmpmeta xmlns:x='adobe:ns:meta/'>
<rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
 <rdf:Description rdf:about=''/>
</rdf:RDF>
</x:xmpmeta>
<?xpacket end='w'?>
`;

describe("README examples", () => {
  afterAll(() => exiftool.end());

  it("basic usage example computes the documented args", () => {
    expect(runBasicExample()).toEqual([
      "-Description=Sunset over the bay",
      "-Keywords+=dusk",
    ]);
  });

  it("exiftool-vendored integration writes only when something changed", async () => {
    const dir = await mkdtemp(join(tmpdir(), "exiftool-arg-diff-"));
    const file = join(dir, "sample.xmp");
    await writeFile(file, MINIMAL_XMP);

    await applyMetadataChange(file, {}, { Description: "hello" });
    expect((await exiftool.read(file)).Description).toBe("hello");

    // Nothing changed: this must not fail even though the underlying
    // exiftool call is skipped.
    await applyMetadataChange(
      file,
      { Description: "hello" },
      { Description: "hello" },
    );
    expect((await exiftool.read(file)).Description).toBe("hello");
  });
});
