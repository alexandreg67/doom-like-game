import { describe, expect, it, vi } from 'vitest';
import TextureManager from '../texture-manager';

// mock logger to capture error calls
vi.mock('../../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

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
      dispose() {
        // simulate async dispose that rejects
        return Promise.reject(new Error('dispose failed'));
      }
    },
    TRILINEAR_SAMPLINGMODE: 2,
    NEAREST_SAMPLINGMODE: 0,
    BILINEAR_SAMPLINGMODE: 1,
  };
});

import type { Mock } from 'vitest';
import { logger } from '../../utils/logger';

describe('TextureManager dispose handling', () => {
  it('handles dispose rejection gracefully and logs error', async () => {
    const mgr = new TextureManager({} as unknown, {
      maxEntries: 10,
      ttlMs: 10000,
    });
    await mgr.load('/to-dispose.png');
    // release should not throw even if dispose rejects
    expect(() => mgr.release('/to-dispose.png')).not.toThrow();
    // give microtasks time to run
    await new Promise((r) => setTimeout(r, 10));
    const errMock = logger.error as unknown as Mock;
    expect(errMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
