import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { describeGeolocationFailure, haversineDistanceMeters, validateCoordinates } from "@/lib/hr/geo";

describe("hr geo", () => {
  it("returns ~0 meters for identical coordinates", () => {
    const distance = haversineDistanceMeters(13.7563, 100.5018, 13.7563, 100.5018);
    assert.ok(distance < 1);
  });

  it("computes a known distance between two coordinates within tolerance", () => {
    // Bangkok (13.7563, 100.5018) to Chiang Mai (18.7883, 98.9853) — ~587 km.
    const distance = haversineDistanceMeters(13.7563, 100.5018, 18.7883, 98.9853);
    assert.ok(distance > 580_000 && distance < 595_000, `got ${distance}`);
  });

  it("computes a small local distance accurately", () => {
    // ~111.19 meters per 0.001 degree of latitude near the equator-ish band.
    const distance = haversineDistanceMeters(13.7563, 100.5018, 13.7573, 100.5018);
    assert.ok(distance > 105 && distance < 118, `got ${distance}`);
  });

  it("is symmetric regardless of point order", () => {
    const a = haversineDistanceMeters(13.7563, 100.5018, 13.76, 100.51);
    const b = haversineDistanceMeters(13.76, 100.51, 13.7563, 100.5018);
    assert.ok(Math.abs(a - b) < 0.0001);
  });

  it("validates coordinates within range", () => {
    assert.deepEqual(validateCoordinates(13.7563, 100.5018), { ok: true });
  });

  it("rejects latitude out of range", () => {
    const result = validateCoordinates(91, 100);
    assert.equal(result.ok, false);
  });

  it("rejects longitude out of range", () => {
    const result = validateCoordinates(10, -181);
    assert.equal(result.ok, false);
  });

  it("rejects non-numeric input", () => {
    const result = validateCoordinates("13.7", undefined);
    assert.equal(result.ok, false);
  });

  it("maps geolocation permission denial to Thai guidance", () => {
    const message = describeGeolocationFailure({ code: 1 });
    assert.match(message, /สิทธิ์เข้าถึงตำแหน่ง|อนุญาต Location/);
  });

  it("maps geolocation timeout to Thai guidance", () => {
    const message = describeGeolocationFailure({ code: 3 });
    assert.match(message, /หมดเวลารอตำแหน่ง/);
  });
});
