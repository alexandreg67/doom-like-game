import { describe, expect, it, vi } from 'vitest';
import TextureManager from '../texture-manager';

vi.mock('@babylonjs/core/Materials/Textures/texture', () => {
  return {
    Texture: class {
      constructor(
        public url: string,
        public scene: unknown,
        _noMipmap: boolean,
        _invertY: boolean,
        _samplingMode: number,
        onLoad?: () => void,
        _onError?: (msg?: string) => void
      ) {
        setTimeout(() => onLoad?.(), 0);
      }
      dispose() {}
    },
    TRILINEAR_SAMPLINGMODE: 2,
    NEAREST_SAMPLINGMODE: 0,
    BILINEAR_SAMPLINGMODE: 1,
  };
});

describe('TextureManager eviction and TTL', () => {
  it('evicts least recently used when over capacity', async () => {
    const mgr = new TextureManager({} as unknown, {
      maxEntries: 2,
      ttlMs: 10000,
    });

    // Load a and b first (order: a=time1, b=time2)
    await mgr.preload(['/a.png', '/b.png']);

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 1));

    // Access a to make it more recent (order: b=time2, a=time3)
    await mgr.load('/a.png');

    // Small delay before loading c
    await new Promise((r) => setTimeout(r, 1));

    // Load c - this should evict b since b is LRU
    await mgr.load('/c.png');

    // Test access - b should be evicted
    const a = mgr.get('/a.png');
    const b = mgr.get('/b.png');
    const c = mgr.get('/c.png');

    expect(a).toBeDefined();
    expect(c).toBeDefined();
    // b should be undefined (evicted)
    expect(b).toBeUndefined();
  });

  it('respects TTL and removes expired entries', async () => {
    const mgr = new TextureManager({} as unknown, {
      maxEntries: 10,
      ttlMs: 10,
    });
    await mgr.load('/ttl.png');
    expect(mgr.get('/ttl.png')).toBeDefined();
    // wait past TTL
    await new Promise((r) => setTimeout(r, 20));
    expect(mgr.get('/ttl.png')).toBeUndefined();
  });
});
