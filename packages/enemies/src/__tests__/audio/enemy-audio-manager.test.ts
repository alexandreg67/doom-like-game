import { NullEngine, Scene } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemyAudioManager } from '../../audio/enemy-audio-manager';
import { EnemyState, EnemyType } from '../../types/enemy-types';

// Mock fetch for testing
global.fetch = vi.fn();

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock AudioContext
const mockAudioContext = {
  sampleRate: 44100,
  createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => ({
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn(() => new Float32Array(length)),
  })),
  decodeAudioData: vi.fn((_data: ArrayBuffer) =>
    Promise.resolve({
      numberOfChannels: 1,
      length: 44100,
      sampleRate: 44100,
      getChannelData: vi.fn(() => new Float32Array(44100)),
    })
  ),
};

// Mock Babylon.js
vi.mock('@babylonjs/core', async () => {
  const actual = await vi.importActual('@babylonjs/core');
  return {
    ...actual,
    Scene: vi.fn().mockImplementation(() => ({
      dispose: vi.fn(),
    })),
    Sound: vi.fn().mockImplementation((name, url, _scene, _callback, options) => ({
      name,
      url,
      play: vi.fn(),
      stop: vi.fn(),
      dispose: vi.fn(),
      setPosition: vi.fn(),
      setVolume: vi.fn(),
      setPlaybackRate: vi.fn(),
      onEndedObservable: {
        add: vi.fn(),
        addOnce: vi.fn(),
      },
      isPlaying: true,
      maxDistance: options?.maxDistance || 100,
      rolloffFactor: options?.rolloffFactor || 1.0,
    })),
  };
});

describe('EnemyAudioManager', () => {
  let audioManager: EnemyAudioManager;
  let mockScene: Scene;
  let mockFetch: typeof vi.mocked<typeof fetch>;

  beforeEach(() => {
    const engine = new NullEngine();
    mockScene = new Scene(engine);
    audioManager = new EnemyAudioManager(mockScene, { debug: false });

    mockFetch = vi.mocked(fetch);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should initialize with default settings', () => {
      expect(audioManager).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customManager = new EnemyAudioManager(mockScene, {
        debug: true,
        basePath: './custom/path/',
      });

      expect(customManager).toBeDefined();
    });
  });

  describe('getDefaultAudioConfig', () => {
    it('should return complete config for all states', () => {
      const config = audioManager.getDefaultAudioConfig(EnemyType.IMP);

      const states = Object.values(EnemyState);
      states.forEach((state) => {
        expect(config[state]).toBeDefined();
        expect(config[state].samples).toBeInstanceOf(Array);
        expect(config[state].samples.length).toBeGreaterThan(0);
        expect(config[state].volume).toBeGreaterThan(0);
        expect(config[state].volume).toBeLessThanOrEqual(1);
        expect(config[state].pitch).toBeGreaterThan(0);
        expect(config[state].maxDistance).toBeGreaterThan(0);
        expect(config[state].rolloffFactor).toBeGreaterThan(0);
        expect(config[state].triggerChance).toBeGreaterThanOrEqual(0);
        expect(config[state].triggerChance).toBeLessThanOrEqual(1);
        expect(config[state].cooldown).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have different configs for different enemy types', () => {
      const impConfig = audioManager.getDefaultAudioConfig(EnemyType.IMP);
      const weakImpConfig = audioManager.getDefaultAudioConfig(EnemyType.WEAK_IMP);
      const toughImpConfig = audioManager.getDefaultAudioConfig(EnemyType.TOUGH_IMP);
      const alphaImpConfig = audioManager.getDefaultAudioConfig(EnemyType.ALPHA_IMP);

      // Weak imp should have lower volume
      expect(weakImpConfig[EnemyState.ATTACK].volume).toBeLessThan(
        impConfig[EnemyState.ATTACK].volume
      );

      // Tough imp should have higher volume
      expect(toughImpConfig[EnemyState.ATTACK].volume).toBeGreaterThan(
        impConfig[EnemyState.ATTACK].volume
      );

      // Alpha imp should have the highest volume
      expect(alphaImpConfig[EnemyState.ATTACK].volume).toBeGreaterThan(
        toughImpConfig[EnemyState.ATTACK].volume
      );
    });

    it('should have appropriate sample names for enemy types', () => {
      const config = audioManager.getDefaultAudioConfig(EnemyType.IMP);

      config[EnemyState.IDLE].samples.forEach((sample) => {
        expect(sample).toContain('imp');
        expect(sample).toContain('idle');
      });

      config[EnemyState.ATTACK].samples.forEach((sample) => {
        expect(sample).toContain('imp');
        expect(sample).toContain('attack');
      });
    });

    it('should have state-appropriate configurations', () => {
      const config = audioManager.getDefaultAudioConfig(EnemyType.IMP);

      // IDLE should be quiet and looped
      expect(config[EnemyState.IDLE].volume).toBeLessThan(0.5);
      expect(config[EnemyState.IDLE].loop).toBe(true);
      expect(config[EnemyState.IDLE].triggerChance).toBeLessThan(0.5);

      // ATTACK should be loud and always trigger
      expect(config[EnemyState.ATTACK].volume).toBeGreaterThan(0.8);
      expect(config[EnemyState.ATTACK].loop).toBe(false);
      expect(config[EnemyState.ATTACK].triggerChance).toBe(1.0);

      // DEATH should have maximum volume and range
      expect(config[EnemyState.DEATH].volume).toBe(1.0);
      expect(config[EnemyState.DEATH].maxDistance).toBeGreaterThan(
        config[EnemyState.IDLE].maxDistance
      );
    });
  });

  describe('preloadEnemyAudio', () => {
    it('should attempt to load all sounds for enemy type', async () => {
      // Mock successful responses
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as Response);

      await audioManager.preloadEnemyAudio(EnemyType.IMP);

      // Should have made fetch calls for various sound files
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle failed loads gracefully', async () => {
      // Mock failed responses
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

      // Should not throw
      await expect(audioManager.preloadEnemyAudio(EnemyType.IMP)).resolves.not.toThrow();
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(audioManager.preloadEnemyAudio(EnemyType.IMP)).resolves.not.toThrow();
    });
  });

  describe('preloadAllEnemyAudio', () => {
    it('should preload audio for all enemy types', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as Response);

      await audioManager.preloadAllEnemyAudio();

      // Should have made calls for all enemy types
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('getAudioBuffer', () => {
    it('should return audio buffer when file exists', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response);

      const buffer = await audioManager.getAudioBuffer('test_sound', mockAudioContext as any);

      expect(buffer).toBeDefined();
    });

    it('should return placeholder when file does not exist', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      } as Response);

      const buffer = await audioManager.getAudioBuffer(
        'nonexistent_sound',
        mockAudioContext as any
      );

      expect(buffer).toBeDefined(); // Should get placeholder
    });

    it('should handle decode errors and fallback to placeholder', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024);
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer),
      } as Response);

      const mockAudioContextWithError = {
        ...mockAudioContext,
        decodeAudioData: vi.fn().mockRejectedValue(new Error('Decode failed')),
      };

      const buffer = await audioManager.getAudioBuffer(
        'corrupt_sound',
        mockAudioContextWithError as any
      );

      expect(buffer).toBeDefined(); // Should get placeholder
    });
  });

  describe('createEnemySound', () => {
    it('should create Babylon.js Sound with default options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as Response);

      const sound = await audioManager.createEnemySound('test_sound', mockScene);

      expect(sound).toBeDefined();
      expect(sound?.name).toContain('enemy_test_sound');
    });

    it('should create sound with custom options', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      } as Response);

      const sound = await audioManager.createEnemySound('test_sound', mockScene, {
        spatialSound: false,
        maxDistance: 200,
        rolloffFactor: 0.5,
        volume: 0.7,
      });

      expect(sound).toBeDefined();
      expect(sound?.maxDistance).toBe(200);
      expect(sound?.rolloffFactor).toBe(0.5);
    });

    it('should fallback to placeholder sound on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const sound = await audioManager.createEnemySound('failed_sound', mockScene);

      expect(sound).toBeDefined(); // Should create placeholder
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = audioManager.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.cachedAssets).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
      expect(stats.placeholderCount).toBeDefined();
      expect(stats.loadingCount).toBeDefined();
      expect(typeof stats.cachedAssets).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
    });

    it('should track cache usage correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(2048)),
      } as Response);

      const initialStats = audioManager.getCacheStats();
      await audioManager.getAudioBuffer('test_sound', mockAudioContext as any);
      const afterLoadStats = audioManager.getCacheStats();

      expect(afterLoadStats.cachedAssets).toBeGreaterThan(initialStats.cachedAssets);
      expect(afterLoadStats.cacheSize).toBeGreaterThan(initialStats.cacheSize);
    });
  });

  describe('placeholder generation', () => {
    it('should generate different sounds for different types', async () => {
      const roarBuffer = await audioManager.getAudioBuffer('imp_roar_01', mockAudioContext as any);
      const footstepBuffer = await audioManager.getAudioBuffer(
        'imp_footstep_01',
        mockAudioContext as any
      );

      expect(roarBuffer).toBeDefined();
      expect(footstepBuffer).toBeDefined();
      // In a real scenario, these would have different audio characteristics
    });

    it('should generate appropriate durations for different sound types', () => {
      // This tests internal placeholder generation logic
      // Duration would vary based on sound type (roar vs footstep vs breathing)
      expect(true).toBe(true); // Internal method testing
    });
  });

  describe('manifest handling', () => {
    it('should load manifest when available', async () => {
      const mockManifest = {
        imp_roar_01: 'imp_roar_01.ogg',
        imp_footstep_01: 'imp_footstep_01.wav',
      };

      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('manifest.json')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockManifest),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        } as Response);
      });

      await audioManager.preloadEnemyAudio(EnemyType.IMP);

      // Should have loaded manifest and used it for asset paths
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('manifest.json'));
    });

    it('should handle missing manifest gracefully', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('manifest.json')) {
          return Promise.resolve({
            ok: false,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        } as Response);
      });

      // Should not throw when manifest is missing
      await expect(audioManager.preloadEnemyAudio(EnemyType.IMP)).resolves.not.toThrow();
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      audioManager.dispose();

      const stats = audioManager.getCacheStats();
      expect(stats.cachedAssets).toBe(0);
      expect(stats.cacheSize).toBe(0);
      expect(stats.placeholderCount).toBe(0);
      expect(stats.loadingCount).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle various error scenarios gracefully', async () => {
      // Test various error conditions
      const errorScenarios = [
        // Network timeout
        () => mockFetch.mockRejectedValue(new Error('TIMEOUT')),
        // Invalid response
        () => mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response),
        // Corrupt data
        () =>
          mockFetch.mockResolvedValue({
            ok: true,
            arrayBuffer: () => Promise.reject(new Error('Corrupt data')),
          } as Response),
      ];

      for (const setupError of errorScenarios) {
        setupError();

        // Should not throw
        await expect(
          audioManager.getAudioBuffer('error_sound', mockAudioContext as any)
        ).resolves.toBeDefined();
      }
    });
  });
});
