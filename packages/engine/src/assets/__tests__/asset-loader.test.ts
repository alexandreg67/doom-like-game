import { type Engine, NullEngine, Scene, Texture } from '@babylonjs/core';
import type { EventState } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AssetLoader } from '../asset-loader';

// Mock fetch globally
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

describe('AssetLoader', () => {
  let engine: Engine;
  let scene: Scene;
  let assetLoader: AssetLoader;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new NullEngine();
    scene = new Scene(engine);
    assetLoader = new AssetLoader(engine, {
      maxRetries: 2,
      retryDelay: 100,
      cacheMaxAge: 1000, // 1 second for testing
    });
  });

  afterEach(() => {
    assetLoader.dispose();
    scene.dispose();
    engine.dispose();
  });

  describe('constructor', () => {
    it('should create AssetLoader with default options', () => {
      const loader = new AssetLoader(engine);
      expect(loader).toBeDefined();
      expect(loader.getCacheSize()).toBe(0);
    });

    it('should create AssetLoader with custom options', () => {
      const loader = new AssetLoader(engine, {
        maxRetries: 5,
        retryDelay: 2000,
        cacheMaxAge: 10000,
      });
      expect(loader).toBeDefined();
    });
  });

  describe('loadTexture (HTMLImageElement)', () => {
    it('should create and load texture', async () => {
      // Create a mock image that loads immediately
      const mockImg = new Image();
      global.Image = vi.fn(() => mockImg);

      // Start loading
      const loadPromise = assetLoader.loadTexture('test.jpg');

      // Immediately trigger onload
      if (mockImg.onload) {
        mockImg.onload(new Event('load'));
      }

      const result = await loadPromise;
      expect(result).toBe(mockImg);
      expect(assetLoader.getCacheSize()).toBe(1);
    });
  });

  describe('loadAudio', () => {
    it('should load audio successfully', async () => {
      const testUrl = 'test-audio.wav';
      const mockBuffer = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as Response);

      const result = await assetLoader.loadAudio(testUrl);
      expect(result).toBe(mockBuffer);
      expect(assetLoader.getCacheSize()).toBe(1);
    });

    it('should return cached audio on subsequent calls', async () => {
      const testUrl = 'test-audio.wav';
      const mockBuffer = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as Response);

      // First load
      const firstResult = await assetLoader.loadAudio(testUrl);

      // Second load should return cached version
      const secondResult = await assetLoader.loadAudio(testUrl);
      expect(secondResult).toBe(firstResult);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch error', async () => {
      const testUrl = 'test-audio.wav';

      // Mock fetch to retourner undefined pour simuler l'échec
      mockFetch.mockResolvedValueOnce(undefined as unknown as Response);

      await expect(assetLoader.loadAudio(testUrl)).rejects.toThrow(
        'Failed to load audio: test-audio.wav - No Response: Unknown error'
      );
    });
  });

  describe('loadWAD', () => {
    it('should load WAD successfully', async () => {
      const testUrl = 'test.wad';
      const mockBuffer = new ArrayBuffer(2048);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as Response);

      const result = await assetLoader.loadWAD(testUrl);
      expect(result).toBe(mockBuffer);
      expect(assetLoader.getCacheSize()).toBe(1);
    });

    it('should handle WAD fetch error', async () => {
      const testUrl = 'test.wad';

      // Mock fetch to retourner undefined pour simuler l'échec
      mockFetch.mockResolvedValueOnce(undefined as unknown as Response);

      await expect(assetLoader.loadWAD(testUrl)).rejects.toThrow(
        'Failed to load WAD: test.wad - No Response: Unknown error'
      );
    });
  });

  describe('loadBabylonTexture', () => {
    it('should load Babylon texture successfully', async () => {
      const testUrl = 'test-babylon-texture.jpg';

      // Create a real texture but control its loading behavior
      const texture = new Texture(testUrl, scene);

      // Mock the onLoadObservable to trigger immediately
      const originalAddOnce = texture.onLoadObservable.addOnce;
      texture.onLoadObservable.addOnce = vi.fn((callback) => {
        // Appelle le callback avec des arguments factices pour respecter la signature
        setTimeout(() => {
          if (callback) {
            callback(texture, {} as EventState);
          }
        }, 1);
        return originalAddOnce.call(texture.onLoadObservable, callback);
      });

      const result = await assetLoader.loadBabylonTexture(testUrl, scene);
      expect(result).toBeInstanceOf(Texture);
      expect(result.url).toBe(testUrl);
      expect(assetLoader.getCacheSize()).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should clear expired assets', async () => {
      const testUrl = 'test-audio.wav';
      const mockBuffer = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as Response);

      // Load asset
      await assetLoader.loadAudio(testUrl);
      expect(assetLoader.getCacheSize()).toBe(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Clear expired assets
      assetLoader.clearExpiredAssets();
      expect(assetLoader.getCacheSize()).toBe(0);
    });

    it('should dispose all assets on dispose', async () => {
      const testUrl = 'test-audio.wav';
      const mockBuffer = new ArrayBuffer(1024);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer),
      } as Response);

      // Load asset
      await assetLoader.loadAudio(testUrl);
      expect(assetLoader.getCacheSize()).toBe(1);

      assetLoader.dispose();
      expect(assetLoader.getCacheSize()).toBe(0);
    });
  });

  describe('preloadTexture', () => {
    it('should preload texture', async () => {
      const testUrl = 'test-preload.jpg';

      // Create a real texture but control its loading behavior
      const texture = new Texture(testUrl, scene);

      // Mock the onLoadObservable to trigger immediately
      const originalAddOnce = texture.onLoadObservable.addOnce;
      texture.onLoadObservable.addOnce = vi.fn((callback) => {
        // Appelle le callback avec des arguments factices pour respecter la signature
        setTimeout(() => {
          if (callback) {
            callback(texture, {} as EventState);
          }
        }, 1);
        return originalAddOnce.call(texture.onLoadObservable, callback);
      });

      const result = await assetLoader.preloadTexture(testUrl, scene);
      expect(result).toBeInstanceOf(Texture);
      expect(result.url).toBe(testUrl);
      expect(assetLoader.getCacheSize()).toBe(1);
    });
  });
});
