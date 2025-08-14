import { type Engine, NullEngine, Scene, Texture } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(assetLoader.loadAudio(testUrl)).rejects.toThrow(
        'Failed to load audio: test-audio.wav - 404: Not Found'
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

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(assetLoader.loadWAD(testUrl)).rejects.toThrow(
        'Failed to load WAD: test.wad - 500: Internal Server Error'
      );
    });
  });

  describe('loadBabylonTexture', () => {
    it('should load Babylon texture successfully', async () => {
      const testUrl = 'test-babylon-texture.jpg';

      // Create a real Texture instance but mock its behavior
      const texture = new Texture(testUrl, scene);

      // Mock the onLoadObservable to call immediately
      vi.spyOn(texture.onLoadObservable, 'addOnce').mockImplementation((callback) => {
        setTimeout(callback, 10);
      });

      const result = await assetLoader.loadBabylonTexture(testUrl, scene);
      expect(result).toBe(texture);
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

      const texture = new Texture(testUrl, scene);

      // Mock the onLoadObservable to call immediately
      vi.spyOn(texture.onLoadObservable, 'addOnce').mockImplementation((callback) => {
        setTimeout(callback, 10);
      });

      const result = await assetLoader.preloadTexture(testUrl, scene);
      expect(result).toBe(texture);
      expect(assetLoader.getCacheSize()).toBe(1);
    });
  });
});
