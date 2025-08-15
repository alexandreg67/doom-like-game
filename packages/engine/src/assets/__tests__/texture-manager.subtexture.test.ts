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

describe('TextureManager sub-texture (atlas) support', () => {
  it('loads atlas image and returns sub-texture handle with uv', async () => {
    const mgr = new TextureManager({} as unknown);
    const atlas = {
      width: 256,
      height: 256,
      placements: [{ id: 't1', x: 0, y: 0, width: 64, height: 64 }],
    };
    mgr.loadAtlasImage('demo', '/textures/atlas.png', atlas as any);
    const sub = await mgr.getSubTexture('demo', 't1');
    expect(sub).toBeDefined();
    expect(sub?.uv).toBeDefined();
    expect(sub?.path).toBe('/textures/atlas.png');
  });
});
