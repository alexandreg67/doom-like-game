import { describe, expect, it } from 'vitest';
import type { AtlasResult } from '../atlas-builder';
import TextureManager from '../texture-manager';

const dummyAtlas: AtlasResult = {
  width: 256,
  height: 256,
  placements: [
    { id: 'tile_a', x: 0, y: 0, width: 64, height: 64 },
    { id: 'tile_b', x: 64, y: 0, width: 64, height: 64 },
  ],
};

describe('TextureManager atlas integration', () => {
  it('registers atlas and returns uv for placement', () => {
    const mgr = new TextureManager({} as unknown);
    mgr.registerAtlas('demo', dummyAtlas);
    const uv = mgr.getUV('demo', 'tile_b');
    expect(uv).toBeDefined();
    expect(uv?.u0).toBeGreaterThan(0);
  });
});
