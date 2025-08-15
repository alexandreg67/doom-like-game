import { describe, expect, it, vi } from 'vitest';
import TextureManager from '../texture-manager';

// On stub la classe Texture de Babylon pour éviter le chargement réel
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
        // simuler un load asynchrone
        setTimeout(() => onLoad?.(), 0);
      }
      updateSamplingMode() {}
    },
    // Sampling mode constants
    TRILINEAR_SAMPLINGMODE: 2,
    NEAREST_SAMPLINGMODE: 0,
    BILINEAR_SAMPLINGMODE: 1,
  };
});

describe('TextureManager (prototype)', () => {
  it('load retourne une Promise qui résout un handle', async () => {
    const fakeScene = {};
    const manager = new TextureManager(fakeScene as unknown as any);
    const handle = await manager.load('/textures/fake.png');
    expect(handle).toHaveProperty('path', '/textures/fake.png');
    expect(handle).toHaveProperty('texture');
  });

  it('preload résout plusieurs textures', async () => {
    const fakeScene = {};
    const manager = new TextureManager(fakeScene as unknown as any);
    const handles = await manager.preload(['/textures/a.png', '/textures/b.png']);
    expect(handles).toHaveLength(2);
  });
});
