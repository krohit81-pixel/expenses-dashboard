/**
 * Minimal pure-JS DOMMatrix polyfill for pdf.js running server-side.
 *
 * v1.3.2: pdf.js's Node build (extract-text.ts) needs a `DOMMatrix`
 * global for some internal 2D matrix math -- a module-level constant is
 * constructed unconditionally the moment pdf.js is first imported, so
 * without this, extraction fails for every PDF, not just unusual ones.
 * pdf.js's own answer to this is an optional native dependency,
 * @napi-rs/canvas, loaded via a `createRequire()` indirection written to
 * survive bundlers. It didn't survive Vercel's deployment file tracer,
 * though (see git history for the two earlier, unsuccessful attempts at
 * fixing that) -- the native binary kept going missing in production
 * despite working locally and in tests. Rather than keep fighting that
 * tracer, this replaces the dependency entirely: a small hand-written
 * DOMMatrix covering just the 2D affine-transform API pdf.js's text
 * extraction path actually touches (confirmed by reading pdf.js's own
 * source for every `new DOMMatrix`/`.multiplySelf`/etc. call site, then
 * verifying end to end against a real HDFC statement with the native
 * package's resolution deliberately blocked, reproducing the exact
 * production failure locally before confirming this fixes it). Ordinary
 * JS, no native binary, nothing for a bundler or file tracer to lose.
 */

interface Matrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

function isMatrix2DLike(value: unknown): value is Partial<Matrix2D> {
  return typeof value === "object" && value !== null;
}

// Standard 2D affine composition: result = m1 * m2, i.e. applying
// `result` to a point is the same as applying m2 then m1. Mirrors the
// formula pdf.js's own `Util.transform` uses internally, so this stays
// consistent with the rest of pdf.js's matrix math.
function multiply(m1: Matrix2D, m2: Matrix2D): Matrix2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

export class DOMMatrixPolyfill implements Matrix2D {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;

  constructor(init?: number[] | Partial<Matrix2D>) {
    if (Array.isArray(init) && init.length === 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    } else if (isMatrix2DLike(init)) {
      this.a = init.a ?? 1;
      this.b = init.b ?? 0;
      this.c = init.c ?? 0;
      this.d = init.d ?? 1;
      this.e = init.e ?? 0;
      this.f = init.f ?? 0;
    }
  }

  multiplySelf(other: Partial<Matrix2D>): this {
    return Object.assign(this, multiply(this, new DOMMatrixPolyfill(other)));
  }

  preMultiplySelf(other: Partial<Matrix2D>): this {
    return Object.assign(this, multiply(new DOMMatrixPolyfill(other), this));
  }

  invertSelf(): this {
    const { a, b, c, d, e, f } = this;
    const det = a * d - b * c;
    if (det === 0) {
      this.a = this.b = this.c = this.d = this.e = this.f = NaN;
      return this;
    }
    const ia = d / det;
    const ib = -b / det;
    const ic = -c / det;
    const id = a / det;
    this.e = -(e * ia + f * ic);
    this.f = -(e * ib + f * id);
    this.a = ia;
    this.b = ib;
    this.c = ic;
    this.d = id;
    return this;
  }

  translate(tx: number, ty = 0): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).multiplySelf({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: tx,
      f: ty,
    });
  }

  scale(sx: number, sy = sx): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).multiplySelf({
      a: sx,
      b: 0,
      c: 0,
      d: sy,
      e: 0,
      f: 0,
    });
  }

  multiply(other: Partial<Matrix2D>): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).multiplySelf(other);
  }
}

/**
 * Sets `globalThis.DOMMatrix` to the polyfill above if nothing has
 * already defined it. Safe to call more than once (idempotent) and
 * deliberately doesn't override a real DOMMatrix if one's already
 * present -- e.g. a browser, or a future Node/edge runtime that ships
 * one natively.
 */
export function installDOMMatrixPolyfill(): void {
  if (!("DOMMatrix" in globalThis)) {
    (globalThis as { DOMMatrix?: unknown }).DOMMatrix = DOMMatrixPolyfill;
  }
}
