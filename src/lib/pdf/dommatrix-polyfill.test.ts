import { afterEach, describe, expect, it } from "vitest";

import {
  DOMMatrixPolyfill,
  installDOMMatrixPolyfill,
} from "./dommatrix-polyfill";

describe("DOMMatrixPolyfill", () => {
  it("defaults to the identity matrix", () => {
    const m = new DOMMatrixPolyfill();
    expect(m).toMatchObject({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it("accepts a 6-element array", () => {
    const m = new DOMMatrixPolyfill([2, 0, 0, 3, 5, 7]);
    expect(m).toMatchObject({ a: 2, b: 0, c: 0, d: 3, e: 5, f: 7 });
  });

  it("accepts another matrix-like object", () => {
    const m = new DOMMatrixPolyfill({ a: 2, d: 3, e: 5, f: 7 });
    expect(m).toMatchObject({ a: 2, b: 0, c: 0, d: 3, e: 5, f: 7 });
  });

  it("translate() returns a new matrix and doesn't mutate the original", () => {
    const m = new DOMMatrixPolyfill();
    const translated = m.translate(10, 20);
    expect(translated).toMatchObject({ a: 1, b: 0, c: 0, d: 1, e: 10, f: 20 });
    expect(m).toMatchObject({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it("scale() returns a new matrix and doesn't mutate the original", () => {
    const m = new DOMMatrixPolyfill();
    const scaled = m.scale(2, -3);
    expect(scaled).toMatchObject({ a: 2, b: 0, c: 0, d: -3, e: 0, f: 0 });
    expect(m).toMatchObject({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it("multiplySelf() composes and mutates in place, returning itself", () => {
    const m = new DOMMatrixPolyfill();
    const result = m.multiplySelf({ a: 2, b: 0, c: 0, d: 2, e: 1, f: 1 });
    expect(result).toBe(m);
    expect(m).toMatchObject({ a: 2, b: 0, c: 0, d: 2, e: 1, f: 1 });
  });

  it("invertSelf() undoes a translate+scale round trip", () => {
    const m = new DOMMatrixPolyfill({ a: 2, d: 4, e: 10, f: -6 });
    const inverted = new DOMMatrixPolyfill(m).invertSelf();
    const roundTrip = inverted.multiplySelf(m);
    // Identity, within floating-point tolerance.
    expect(roundTrip.a).toBeCloseTo(1);
    expect(roundTrip.d).toBeCloseTo(1);
    expect(roundTrip.e).toBeCloseTo(0);
    expect(roundTrip.f).toBeCloseTo(0);
  });

  it("invertSelf() produces NaN entries for a singular matrix rather than throwing", () => {
    const m = new DOMMatrixPolyfill({ a: 0, b: 0, c: 0, d: 0 });
    expect(() => m.invertSelf()).not.toThrow();
    expect(Number.isNaN(m.a)).toBe(true);
  });
});

describe("installDOMMatrixPolyfill", () => {
  afterEach(() => {
    delete (globalThis as { DOMMatrix?: unknown }).DOMMatrix;
  });

  it("sets globalThis.DOMMatrix when nothing else has", () => {
    delete (globalThis as { DOMMatrix?: unknown }).DOMMatrix;
    installDOMMatrixPolyfill();
    expect(globalThis.DOMMatrix).toBe(DOMMatrixPolyfill);
  });

  it("doesn't override an already-present DOMMatrix", () => {
    class RealDOMMatrix {}
    (globalThis as { DOMMatrix?: unknown }).DOMMatrix = RealDOMMatrix;
    installDOMMatrixPolyfill();
    expect(globalThis.DOMMatrix).toBe(RealDOMMatrix);
  });
});
