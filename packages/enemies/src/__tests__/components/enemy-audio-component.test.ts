import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type EnemyAudioComponent, EnemyAudioUtils } from '../../components/enemy-audio-component';
import { EnemyState, EnemyType } from '../../types/enemy-types';

// Mock Babylon.js Scene for testing
vi.mock('@babylonjs/core', async () => {
  const actual = await vi.importActual('@babylonjs/core');
  return {
    ...actual,
    Scene: vi.fn().mockImplementation(() => ({
      dispose: vi.fn(),
    })),
  };
});

describe('EnemyAudioComponent', () => {
  let mockScene: Scene;
  let component: EnemyAudioComponent;

  beforeEach(() => {
    // Create mock scene
    const engine = new NullEngine();
    mockScene = new Scene(engine);

    // Create test component
    component = EnemyAudioUtils.createComponent(EnemyType.IMP, mockScene);
  });

  describe('createComponent', () => {
    it('should create component with correct default values', () => {
      expect(component.id).toBe('enemyAudio');
      expect(component.enemyType).toBe(EnemyType.IMP);
      expect(component.currentAudioState).toBe(EnemyState.IDLE);
      expect(component.isEnabled).toBe(true);
      expect(component.masterVolume).toBe(1.0);
      expect(component.activeSounds.size).toBe(0);
      expect(component.distanceToListener).toBe(0);
      expect(component.isDistanceMuted).toBe(false);
    });

    it('should have audio config for all enemy states', () => {
      const states = Object.values(EnemyState);
      states.forEach((state) => {
        expect(component.audioConfig[state]).toBeDefined();
        expect(component.audioConfig[state].samples).toBeDefined();
        expect(component.audioConfig[state].volume).toBeGreaterThan(0);
      });
    });

    it('should initialize last trigger times for all states', () => {
      const states = Object.values(EnemyState);
      states.forEach((state) => {
        expect(component.lastTriggerTime[state]).toBe(0);
      });
    });
  });

  describe('updateComponent', () => {
    it('should update position and state correctly', () => {
      const newPosition = new Vector3(10, 0, 5);
      const newState = EnemyState.CHASE;
      const distance = 25.5;

      EnemyAudioUtils.updateComponent(component, newState, newPosition, distance, 0.016);

      expect(component.currentAudioState).toBe(newState);
      expect(component.previousAudioState).toBe(EnemyState.IDLE);
      expect(component.cachedPosition.equals(newPosition)).toBe(true);
      expect(component.distanceToListener).toBe(distance);
    });

    it('should handle distance-based muting', () => {
      const farPosition = new Vector3(0, 0, 0);
      const veryLongDistance = 200; // Beyond max audible distance

      EnemyAudioUtils.updateComponent(
        component,
        EnemyState.CHASE,
        farPosition,
        veryLongDistance,
        0.016
      );

      expect(component.isDistanceMuted).toBe(true);
    });

    it('should not mute at reasonable distances', () => {
      const closePosition = new Vector3(0, 0, 0);
      const reasonableDistance = 50;

      EnemyAudioUtils.updateComponent(
        component,
        EnemyState.CHASE,
        closePosition,
        reasonableDistance,
        0.016
      );

      expect(component.isDistanceMuted).toBe(false);
    });
  });

  describe('canTriggerAudio', () => {
    it('should allow triggering when enabled and not muted', () => {
      component.isEnabled = true;
      component.isDistanceMuted = false;

      const canTrigger = EnemyAudioUtils.canTriggerAudio(
        component,
        EnemyState.ATTACK,
        performance.now()
      );

      expect(canTrigger).toBe(true);
    });

    it('should prevent triggering when disabled', () => {
      component.isEnabled = false;

      const canTrigger = EnemyAudioUtils.canTriggerAudio(
        component,
        EnemyState.ATTACK,
        performance.now()
      );

      expect(canTrigger).toBe(false);
    });

    it('should prevent triggering when distance muted', () => {
      component.isEnabled = true;
      component.isDistanceMuted = true;

      const canTrigger = EnemyAudioUtils.canTriggerAudio(
        component,
        EnemyState.ATTACK,
        performance.now()
      );

      expect(canTrigger).toBe(false);
    });

    it('should respect cooldown periods', () => {
      const currentTime = performance.now();
      const state = EnemyState.ATTACK;

      // Mark as recently triggered
      EnemyAudioUtils.markAudioTriggered(component, state, currentTime - 100); // 100ms ago

      // Should be blocked by cooldown (attack cooldown is 300ms)
      const canTrigger = EnemyAudioUtils.canTriggerAudio(component, state, currentTime);
      expect(canTrigger).toBe(false);
    });

    it('should allow triggering after cooldown expires', () => {
      const currentTime = performance.now();
      const state = EnemyState.ATTACK;

      // Mark as triggered longer ago than cooldown
      EnemyAudioUtils.markAudioTriggered(component, state, currentTime - 1000); // 1000ms ago

      const canTrigger = EnemyAudioUtils.canTriggerAudio(component, state, currentTime);
      expect(canTrigger).toBe(true);
    });
  });

  describe('getAudioConfig', () => {
    it('should return correct config for each state', () => {
      const idleConfig = EnemyAudioUtils.getAudioConfig(component, EnemyState.IDLE);
      expect(idleConfig.samples).toContain('imp_idle_01');
      expect(idleConfig.loop).toBe(true);

      const attackConfig = EnemyAudioUtils.getAudioConfig(component, EnemyState.ATTACK);
      expect(attackConfig.samples).toContain('imp_attack_01');
      expect(attackConfig.triggerChance).toBe(1.0);
    });

    it('should have different configs for different states', () => {
      const idleConfig = EnemyAudioUtils.getAudioConfig(component, EnemyState.IDLE);
      const attackConfig = EnemyAudioUtils.getAudioConfig(component, EnemyState.ATTACK);

      expect(idleConfig.volume).not.toBe(attackConfig.volume);
      expect(idleConfig.triggerChance).not.toBe(attackConfig.triggerChance);
    });
  });

  describe('sound management', () => {
    it('should track active sounds correctly', () => {
      const mockSound = {
        stop: vi.fn(),
        dispose: vi.fn(),
        isPlaying: true,
      } as any;

      EnemyAudioUtils.addActiveSound(component, 'test_sound_1', mockSound);
      expect(component.activeSounds.size).toBe(1);
      expect(component.activeSounds.has('test_sound_1')).toBe(true);
    });

    it('should remove and dispose sounds correctly', () => {
      const mockSound = {
        stop: vi.fn(),
        dispose: vi.fn(),
        isPlaying: false,
      } as any;

      EnemyAudioUtils.addActiveSound(component, 'test_sound_1', mockSound);
      EnemyAudioUtils.removeActiveSound(component, 'test_sound_1');

      expect(component.activeSounds.size).toBe(0);
      expect(mockSound.stop).toHaveBeenCalled();
      expect(mockSound.dispose).toHaveBeenCalled();
    });

    it('should stop all sounds when requested', () => {
      const mockSound1 = { stop: vi.fn(), dispose: vi.fn() } as any;
      const mockSound2 = { stop: vi.fn(), dispose: vi.fn() } as any;

      EnemyAudioUtils.addActiveSound(component, 'sound1', mockSound1);
      EnemyAudioUtils.addActiveSound(component, 'sound2', mockSound2);

      EnemyAudioUtils.stopAllSounds(component);

      expect(component.activeSounds.size).toBe(0);
      expect(mockSound1.stop).toHaveBeenCalled();
      expect(mockSound2.stop).toHaveBeenCalled();
    });
  });

  describe('getComponentStats', () => {
    it('should return accurate statistics', () => {
      const mockSound = { stop: vi.fn(), dispose: vi.fn() } as any;
      EnemyAudioUtils.addActiveSound(component, 'test_sound', mockSound);

      const stats = EnemyAudioUtils.getComponentStats(component);

      expect(stats.activeAudioSources).toBe(1);
      expect(stats.audioSourcesByType?.[EnemyType.IMP]).toBe(1);
      expect(stats.audioSourcesByState?.[EnemyState.IDLE]).toBe(1);
    });

    it('should return zero stats for empty component', () => {
      const stats = EnemyAudioUtils.getComponentStats(component);

      expect(stats.activeAudioSources).toBe(0);
    });
  });

  describe('enemy type specific configurations', () => {
    it('should create different configs for different enemy types', () => {
      const weakImpComponent = EnemyAudioUtils.createComponent(EnemyType.WEAK_IMP, mockScene);
      const toughImpComponent = EnemyAudioUtils.createComponent(EnemyType.TOUGH_IMP, mockScene);
      const alphaImpComponent = EnemyAudioUtils.createComponent(EnemyType.ALPHA_IMP, mockScene);

      // Test that different enemy types have different volume levels
      const normalVolume = component.audioConfig[EnemyState.ATTACK].volume;
      const weakVolume = weakImpComponent.audioConfig[EnemyState.ATTACK].volume;
      const toughVolume = toughImpComponent.audioConfig[EnemyState.ATTACK].volume;
      const alphaVolume = alphaImpComponent.audioConfig[EnemyState.ATTACK].volume;

      expect(weakVolume).toBeLessThan(normalVolume);
      expect(toughVolume).toBeGreaterThan(normalVolume);
      expect(alphaVolume).toBeGreaterThan(normalVolume);
      expect(alphaVolume).toBeGreaterThan(toughVolume);
    });

    it('should have appropriate sample names for enemy types', () => {
      Object.values(EnemyState).forEach((state) => {
        const config = component.audioConfig[state];
        config.samples.forEach((sample) => {
          expect(sample).toContain('imp'); // Should contain enemy type
        });
      });
    });
  });

  describe('markAudioTriggered', () => {
    it('should update last trigger time', () => {
      const currentTime = performance.now();
      const state = EnemyState.CHASE;

      EnemyAudioUtils.markAudioTriggered(component, state, currentTime);

      expect(component.lastTriggerTime[state]).toBe(currentTime);
    });

    it('should not affect other states trigger times', () => {
      const currentTime = performance.now();
      const originalIdleTime = component.lastTriggerTime[EnemyState.IDLE];

      EnemyAudioUtils.markAudioTriggered(component, EnemyState.CHASE, currentTime);

      expect(component.lastTriggerTime[EnemyState.IDLE]).toBe(originalIdleTime);
      expect(component.lastTriggerTime[EnemyState.CHASE]).toBe(currentTime);
    });
  });
});
