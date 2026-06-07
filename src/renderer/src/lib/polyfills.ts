// Polyfills for very new JS proposals that some dependencies (notably
// pdfjs-dist v5) assume exist. Electron's bundled V8 may lag behind these
// stage-3/4 proposals, so without this pdf.js render() throws
// "Map.prototype.getOrInsertComputed is not a function" and the page paints
// black. Implements the TC39 "Upsert" proposal for Map and WeakMap.
//
// Import this BEFORE anything that pulls in pdfjs-dist.

type AnyMap<K, V> = {
  has(key: K): boolean
  get(key: K): V | undefined
  set(key: K, value: V): unknown
}

function installUpsert(proto: AnyMap<unknown, unknown> | undefined): void {
  if (!proto) return
  const p = proto as Record<string, unknown>
  if (typeof p.getOrInsert !== 'function') {
    Object.defineProperty(p, 'getOrInsert', {
      configurable: true,
      writable: true,
      value: function (this: AnyMap<unknown, unknown>, key: unknown, value: unknown) {
        if (this.has(key)) return this.get(key)
        this.set(key, value)
        return value
      }
    })
  }
  if (typeof p.getOrInsertComputed !== 'function') {
    Object.defineProperty(p, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function (
        this: AnyMap<unknown, unknown>,
        key: unknown,
        callbackFn: (key: unknown) => unknown
      ) {
        if (this.has(key)) return this.get(key)
        const value = callbackFn(key)
        this.set(key, value)
        return value
      }
    })
  }
}

installUpsert(Map.prototype as unknown as AnyMap<unknown, unknown>)
installUpsert(WeakMap.prototype as unknown as AnyMap<unknown, unknown>)

// Math.sumPrecise (TC39 proposal) — pdf.js v5 uses it for high-precision
// glyph positioning and falls back noisily without it. Provide a correct
// (Neumaier/Kahan-Babuška compensated) summation so text layers line up.
type MathWithSum = Math & { sumPrecise?: (values: Iterable<number>) => number }
const M = Math as MathWithSum
if (typeof M.sumPrecise !== 'function') {
  Object.defineProperty(M, 'sumPrecise', {
    configurable: true,
    writable: true,
    value: function (values: Iterable<number>): number {
      let sum = 0
      let c = 0
      for (const v of values) {
        const t = sum + v
        if (Math.abs(sum) >= Math.abs(v)) {
          c += sum - t + v
        } else {
          c += v - t + sum
        }
        sum = t
      }
      return sum + c
    }
  })
}
