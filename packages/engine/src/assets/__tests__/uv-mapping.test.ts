import { describe, expect, it } from 'vitest';
import type { Placement } from '../atlas-builder';
import { placementToUV } from '../uv-mapping';

describe('uv-mapping', () => {
  it('converts placement to normalized UVs', () => {
    const p: Placement = { id: 'a', x: 0, y: 0, width: 64, height: 64 };
    const uv = placementToUV(p, 256, 256);
    expect(uv.u0).toBe(0);
    expect(uv.v0).toBe(0);
    expect(uv.u1).toBe(0.25);
    expect(uv.v1).toBe(0.25);
  });
});
