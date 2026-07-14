import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveImageMime,
  sniffImageMime,
} from "../../lib/media/image-mime";

test("sniffs jpeg magic bytes when mime is empty", () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(sniffImageMime(bytes), "image/jpeg");
  assert.equal(
    resolveImageMime({ type: "", name: "capture", bytes }),
    "image/jpeg",
  );
});

test("normalizes image/jpg and file extensions", () => {
  const bytes = new Uint8Array([0x00]);
  assert.equal(
    resolveImageMime({ type: "image/jpg", name: "a.bin", bytes }),
    "image/jpeg",
  );
  assert.equal(
    resolveImageMime({ type: "", name: "photo.PNG", bytes }),
    "image/png",
  );
});
