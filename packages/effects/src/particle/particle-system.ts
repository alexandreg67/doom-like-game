/**
 * Particle System for Impact Effects using Babylon.js
 */

import {
  Color4,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  StandardMaterial,
  Texture,
  Vector3,
} from '@babylonjs/core';
import type { Color3, Scene } from '@babylonjs/core';
import type {
  ImpactData,
  ImpactEffectType,
  ImpactParticleConfig,
  MaterialType,
} from '../impact/impact-types';

export class ImpactParticleSystem {
  // Debug visuals toggles
  private static readonly OVERLAY_ENABLED = false; // Disable on production
  private static readonly MARKERS_ENABLED = false; // Disable debug markers
  private scene: Scene;
  private particlePool: ParticleSystem[] = [];
  private activeParticleSystems: Map<string, ParticleSystem> = new Map();
  private textureCache: Map<string, Texture> = new Map();
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private particleTimers: Map<string, NodeJS.Timeout> = new Map(); // Track timers to prevent leaks
  private debugOverlay: HTMLElement | null = null;
  private debugContent: HTMLElement | null = null;
  private lastEmitRate = 0;
  private lastManualEmitCount = 0;
  private lastSystemTimestamp: number | null = null;
  private lastSystemDiagnostics: { [key: string]: unknown } | null = null;
  private lastSampleTimer: NodeJS.Timeout | null = null;
  private lastCreateCallTimestamp: number | null = null;
  private lastCreateCallInfo: { [key: string]: unknown } | null = null;
  // Debug toggle: when true, always create new ParticleSystem and skip pool reuse.
  // Default to false in production to avoid exhausting the active systems limit
  // and causing a visible "fenêtre" where no more effects can spawn.
  private debugAlwaysCreateNew = false;

  private sampleLastSystem(durationMs: number, intervalMs: number): void {
    try {
      if (this.lastSampleTimer) {
        clearInterval(this.lastSampleTimer);
        this.lastSampleTimer = null;
      }
      const start = Date.now();
      const samples: Array<{ t: number; count: number }> = [];
      const tick = () => {
        try {
          const lastPS = (globalThis as unknown as Record<string, unknown>)
            .__lastImpactParticleSystem as ParticleSystem | undefined;
          const count = lastPS
            ? ((lastPS as unknown as { _particles?: unknown[] })._particles?.length ?? 0)
            : 0;
          samples.push({ t: Date.now() - start, count });
          // store in diagnostics if present
          if (this.lastSystemDiagnostics) {
            this.lastSystemDiagnostics.samples = samples.slice();
            try {
              this.updateDebugOverlay();
            } catch (_e) {}
          }
        } catch (_e) {}
        if (Date.now() - start >= durationMs) {
          if (this.lastSampleTimer) {
            clearInterval(this.lastSampleTimer);
            this.lastSampleTimer = null;
          }
        }
      };
      // initial tick then interval
      tick();
      this.lastSampleTimer = setInterval(() => tick(), intervalMs);
    } catch (_e) {
      // ignore
    }
  }

  // New: support multiple sampling intervals (diagnostic). Stores timers per interval.
  private lastSampleTimers: Map<number, NodeJS.Timeout> = new Map();

  private sampleLastSystemVariants(durationMs: number, intervals: number[]): void {
    try {
      // clear existing variant timers
      for (const t of this.lastSampleTimers.values()) {
        clearInterval(t as unknown as NodeJS.Timeout);
      }
      this.lastSampleTimers.clear();

      const start = Date.now();
      if (!this.lastSystemDiagnostics) this.lastSystemDiagnostics = {};
      this.lastSystemDiagnostics.samplesByInterval = {};

      for (const intervalMs of intervals) {
        const samples: Array<{ t: number; count: number }> = [];
        const tick = () => {
          try {
            const lastPS = (globalThis as unknown as Record<string, unknown>)
              .__lastImpactParticleSystem as ParticleSystem | undefined;
            const count = lastPS
              ? ((lastPS as unknown as { _particles?: unknown[] })._particles?.length ?? 0)
              : 0;
            samples.push({ t: Date.now() - start, count });
            // store in diagnostics per interval
            if (this.lastSystemDiagnostics) {
              // diagnostics disabled in production
              try {
                this.updateDebugOverlay();
              } catch (_e) {}
            }
          } catch (_e) {}
        };

        // initial tick then interval
        tick();
        const handle = setInterval(() => tick(), intervalMs);
        this.lastSampleTimers.set(intervalMs, handle);

        // clear this interval after duration
        setTimeout(() => {
          try {
            const h = this.lastSampleTimers.get(intervalMs);
            if (h) {
              clearInterval(h as unknown as NodeJS.Timeout);
              this.lastSampleTimers.delete(intervalMs);
            }
          } catch (_e) {}
        }, durationMs + 50);
      }
    } catch (_e) {
      // ignore
    }
  }

  private wrapStopLogger(_ps: ParticleSystem): void {
    // Debug stop logger disabled in production
  }

  constructor(scene: Scene) {
    this.scene = scene;
    // No-op: Babylon.js does not expose a public `particlesEnabled` switch on Scene.
    // Assume particles are processed by default; if not, it should be configured via engine/scene setup.
    // Ensure textures are preloaded so particleTexture lookups succeed
    try {
      this.preloadTextures();
      console.log('🔧 [PARTICLE_SYSTEM] Preloaded particle textures');
    } catch (e) {
      console.warn('⚠️ [PARTICLE_SYSTEM] Failed to preload textures:', e);
    }

    // Start periodic cleanup to prevent memory leaks
    this.startPeriodicMaintenance();
  }

  // Start the system and force a visible burst reliably
  private startWithBurst(ps: ParticleSystem, count: number): void {
    try {
      // Always (re)start before setting manual count to ensure the system is ticking
      if ((ps as { start?: () => void }).start) (ps as { start?: () => void }).start?.();
      // Try immediate manual burst
      ps.manualEmitCount = Math.max(count, 1);
      this.lastManualEmitCount = ps.manualEmitCount;

      // Fallback: if the engine hasn't consumed manualEmitCount shortly, poke it again
      setTimeout(() => {
        try {
          const internal = (ps as unknown as { _particles?: unknown[] })._particles?.length ?? 0;
          if (internal === 0 && (ps.manualEmitCount || 0) > 0) {
            // Nudge: toggle emitRate for a single frame to guarantee emission path runs
            const prevRate = ps.emitRate;
            ps.emitRate = Math.max(prevRate, Math.min(count, 100));
            // Schedule restore and reapply manual count once more
            setTimeout(() => {
              try {
                ps.emitRate = prevRate;
                ps.manualEmitCount = Math.max(count, 1);
                this.lastManualEmitCount = ps.manualEmitCount;
                // debug overlay disabled
              } catch {}
            }, 16);
          }
        } catch {}
      }, 50);
    } catch {}
  }

  /**
   * Create impact particles based on material and effect type
   */
  public createImpactParticles(
    impactData: ImpactData,
    effectType: ImpactEffectType,
    particleCount: number
  ): string {
    try {
      this.lastCreateCallTimestamp = Date.now();
      this.lastCreateCallInfo = {
        effectType,
        particleCount,
        position: impactData.position,
        stack: (new Error().stack || '').split('\n').slice(0, 5).join(' | '),
      };
      console.log('🧭 [PARTICLE_SYSTEM] createImpactParticles called:', this.lastCreateCallInfo);
    } catch (_e) {}
    const config = this.getParticleConfigForEffect(effectType, impactData.materialType);
    const particleSystem = this.getOrCreateParticleSystem();

    if (!particleSystem) {
      throw new Error('Unable to create particle system');
    }

    // Defensive reset only: ensure system isn't in a stopped state from reuse
    try {
      const maybe = particleSystem as unknown as { reset?: () => void };
      if (typeof maybe.reset === 'function') {
        maybe.reset();
      }
    } catch (_e) {
      // ignore
    }

    // Configure particle system
    this.configureParticleSystem(particleSystem, impactData, config, particleCount);

    // Generate unique ID for this effect
    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);

    // Force an immediate burst to avoid timing issues
    try {
      this.startWithBurst(particleSystem, Math.max(particleCount, 20));
    } catch (_e) {}
    // Expose last created for quick debug

    console.log(
      `✨ [PARTICLE_SYSTEM] Started particle system: ${effectId}, emitRate: ${
        particleSystem.emitRate
      }, capacity: ${particleSystem.getCapacity()}, isStarted: ${particleSystem.isStarted()}`
    );

    // Instead of setTimeout, use natural particle lifecycle events
    this.setupParticleLifecycleCleanup(particleSystem, effectId);

    return effectId;
  }

  /**
   * Create sparks effect for metal impacts
   */
  public createSparks(impactData: ImpactData, intensity = 1.0): string {
    const particleSystem = this.getOrCreateParticleSystem();
    if (!particleSystem) {
      throw new Error('Unable to create spark particle system');
    }

    // Defensive reset only to clear stopped state from previous usage
    try {
      const maybe = particleSystem as unknown as { reset?: () => void };
      if (typeof maybe.reset === 'function') maybe.reset();
    } catch (_e) {}

    // Configure for sparks
    particleSystem.particleTexture = this.getTexture('spark');
    particleSystem.emitter = this.createEmitterAtPosition(impactData.position);

    // Spark-specific properties
    particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    particleSystem.color1 = new Color4(1.0, 0.8, 0.2, 1.0); // Bright yellow
    particleSystem.color2 = new Color4(1.0, 0.4, 0.0, 1.0); // Orange
    particleSystem.colorDead = new Color4(0.5, 0.1, 0.0, 0.0); // Dark red, transparent

    particleSystem.minSize = 0.1; // 5x plus grand !
    particleSystem.maxSize = 0.3; // 6x plus grand !

    particleSystem.minLifeTime = 1.0; // Extended spark lifetime
    particleSystem.maxLifeTime = 2.5; // Extended max spark lifetime

    particleSystem.emitRate = Math.floor(150 * intensity);
    particleSystem.maxEmitPower = 3.0;
    particleSystem.minEmitPower = 1.5;

    // Gravity and physics
    particleSystem.gravity = new Vector3(0, -9.8, 0);

    // Direction based on surface normal
    const reflectedDirection = this.calculateReflectionDirection(
      impactData.velocity,
      impactData.normal
    );
    particleSystem.direction1 = reflectedDirection.scale(0.5);
    particleSystem.direction2 = reflectedDirection.scale(1.5);
    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);

    // Start with burst for reliable one-shot emission
    this.startWithBurst(particleSystem, Math.max(Math.floor(150 * intensity), 20));

    // Record diagnostics
    try {
      this.lastSystemTimestamp = Date.now();
      this.lastSystemDiagnostics = {
        emitRate: particleSystem.emitRate,
        manualEmitCount: particleSystem.manualEmitCount,
        minSize: particleSystem.minSize,
        maxSize: particleSystem.maxSize,
        minLifeTime: particleSystem.minLifeTime,
        maxLifeTime: particleSystem.maxLifeTime,
        isStarted: particleSystem.isStarted(),
        hasTexture: !!particleSystem.particleTexture,
        samples: [] as Array<{ t: number; count: number }>,
      };
      this.sampleLastSystem(2000, 100);
    } catch (_e) {}

    // Use intelligent cleanup instead of fixed timeout
    this.setupParticleLifecycleCleanup(particleSystem, effectId);

    return effectId;
  }

  /**
   * Create debris effect for hard materials
   */
  public createDebris(impactData: ImpactData, materialType: MaterialType): string {
    const particleSystem = this.getOrCreateParticleSystem();
    if (!particleSystem) {
      throw new Error('Unable to create debris particle system');
    }

    // Defensive reset only to clear stopped state from previous usage
    try {
      const maybe = particleSystem as unknown as { reset?: () => void };
      if (typeof maybe.reset === 'function') maybe.reset();
    } catch (_e) {}

    // Configure for debris
    particleSystem.particleTexture = this.getTexture(`debris_${materialType}`);
    particleSystem.emitter = this.createEmitterAtPosition(impactData.position);

    // Material-specific colors
    const colors = this.getDebrisColors(materialType);
    particleSystem.color1 = colors.primary;
    particleSystem.color2 = colors.secondary;
    particleSystem.colorDead = colors.dead;

    // Size varies by material density
    const sizeMultiplier = this.getSizeMultiplierForMaterial(materialType);
    particleSystem.minSize = 0.15 * sizeMultiplier; // 5x plus grand
    particleSystem.maxSize = 0.4 * sizeMultiplier; // 5x plus grand

    particleSystem.minLifeTime = 2.0; // Extended debris lifetime
    particleSystem.maxLifeTime = 5.0; // Extended max debris lifetime

    particleSystem.emitRate = 80;
    particleSystem.maxEmitPower = 2.0;
    particleSystem.minEmitPower = 0.5;

    // Physics properties
    particleSystem.gravity = new Vector3(0, -9.8, 0);

    // Direction influenced by impact angle
    const scatterDirection = this.calculateScatterDirection(
      impactData.normal,
      impactData.surfaceAngle
    );
    particleSystem.direction1 = scatterDirection.scale(0.3);
    particleSystem.direction2 = scatterDirection.scale(1.0);

    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);

    // Start with burst so emission occurs at configured emitter
    this.startWithBurst(particleSystem, 40);

    // debug diagnostics removed
    // Stop emission is handled by particle lifetime and lifecycle cleanup.
    // Removed short timeout stop() which could preemptively stop the system.

    // Use intelligent cleanup instead of fixed timeout
    this.setupParticleLifecycleCleanup(particleSystem, effectId);

    return effectId;
  }

  /**
   * Create dust cloud effect
   */
  public createDust(impactData: ImpactData, materialType: MaterialType): string {
    const particleSystem = this.getOrCreateParticleSystem();
    if (!particleSystem) {
      throw new Error('Unable to create dust particle system');
    }

    // Defensive reset only to clear stopped state from previous usage
    try {
      const maybe = particleSystem as unknown as { reset?: () => void };
      if (typeof maybe.reset === 'function') maybe.reset();
    } catch (_e) {}

    // Configure for dust
    particleSystem.particleTexture = this.getTexture('dust');
    particleSystem.emitter = this.createEmitterAtPosition(impactData.position);

    // Dust area
    particleSystem.minEmitBox = new Vector3(-0.3, 0, -0.3);
    particleSystem.maxEmitBox = new Vector3(0.3, 0.3, 0.3);

    // Material-specific dust colors
    const dustColor = this.getDustColorForMaterial(materialType);
    particleSystem.color1 = dustColor;
    particleSystem.color2 = dustColor;
    particleSystem.colorDead = new Color4(dustColor.r, dustColor.g, dustColor.b, 0);

    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.4;

    particleSystem.minLifeTime = 4.0; // Extended dust lifetime
    particleSystem.maxLifeTime = 8.0; // Extended max dust lifetime

    particleSystem.emitRate = 50;
    particleSystem.maxEmitPower = 0.5;
    particleSystem.minEmitPower = 0.1;

    // Minimal gravity for floating dust
    particleSystem.gravity = new Vector3(0, -0.5, 0);

    // Slow, spreading movement
    particleSystem.direction1 = new Vector3(-0.5, 0, -0.5);
    particleSystem.direction2 = new Vector3(0.5, 1.0, 0.5);

    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);

    // Start with burst so emission occurs at configured emitter
    this.startWithBurst(particleSystem, 40);

    // debug diagnostics removed
    // Stop emission is handled by particle lifetime and lifecycle cleanup.
    // Removed short timeout stop() which could preemptively stop the system.

    // Use intelligent cleanup instead of fixed timeout
    this.setupParticleLifecycleCleanup(particleSystem, effectId);

    return effectId;
  }

  /**
   * Stop and cleanup specific particle effect
   */
  public stopEffect(effectId: string): void {
    this.cleanupParticleSystem(effectId);
  }

  /**
   * Stop all active particle effects
   */
  public stopAllEffects(): void {
    for (const effectId of this.activeParticleSystems.keys()) {
      this.cleanupParticleSystem(effectId);
    }
  }

  /**
   * Get current active effects count
   */
  public getActiveEffectCount(): number {
    return this.activeParticleSystems.size;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.stopAllEffects();

    // Stop periodic maintenance
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }

    // Clear all particle timers to prevent leaks
    for (const [_effectId, timer] of this.particleTimers.entries()) {
      clearTimeout(timer);
    }
    this.particleTimers.clear();
    console.log('🧹 [PARTICLE_SYSTEM] Cleared all monitoring timers on dispose');

    // Dispose textures
    for (const texture of this.textureCache.values()) {
      texture.dispose();
    }
    this.textureCache.clear();

    // Dispose particle pool
    for (const particleSystem of this.particlePool) {
      particleSystem.dispose();
    }
    this.particlePool = [];
  }

  /**
   * Start periodic maintenance to clean up stale systems
   */
  private startPeriodicMaintenance(): void {
    this.maintenanceTimer = setInterval(() => {
      this.performMaintenance();
    }, 10000); // Every 10 seconds
  }

  /**
   * Perform periodic maintenance
   */
  private performMaintenance(): void {
    console.log('🔧 [PARTICLE_SYSTEM] Performing periodic maintenance...');
    console.log(
      `📊 [PARTICLE_SYSTEM] Status: ${this.activeParticleSystems.size} active, ${this.particlePool.length} in pool, ${this.particleTimers.size} timers`
    );

    // Scene-level forced cleanup removed (avoid private internals)

    // Clean up systems that might have gotten stuck
    const staleThreshold = 120000; // 2 minutes
    const now = Date.now();

    for (const [effectId, _particleSystem] of this.activeParticleSystems.entries()) {
      // Extract timestamp from effect ID
      const match = effectId.match(/effect_(\d+)_/);
      if (match?.[1]) {
        const timestamp = Number.parseInt(match[1], 10);
        if (now - timestamp > staleThreshold) {
          console.log('🧽 [PARTICLE_SYSTEM] Cleaning up stale system:', effectId);
          this.cleanupParticleSystem(effectId);
        }
      }
    }

    // Clean up orphaned timers (timers without corresponding active systems)
    for (const effectId of this.particleTimers.keys()) {
      if (!this.activeParticleSystems.has(effectId)) {
        const timer = this.particleTimers.get(effectId);
        if (timer) {
          clearTimeout(timer);
          this.particleTimers.delete(effectId);
          console.log('🧹 [PARTICLE_SYSTEM] Cleaned up orphaned timer for:', effectId);
        }
      }
    }
  }

  /**
   * Create a small temporary debug marker (sphere) at impact position
   */
  private createDebugMarker(position: Vector3, color: Color3, lifetimeMs: number): void {
    if (!ImpactParticleSystem.MARKERS_ENABLED) return;
    try {
      const mat = new StandardMaterial(`impact_marker_mat_${Date.now()}`, this.scene);
      mat.emissiveColor = color;
      // Create small sphere
      const sphere = MeshBuilder.CreateSphere(
        `impact_marker_${Date.now()}`,
        { diameter: 0.08 },
        this.scene
      );
      sphere.material = mat;
      sphere.position = position.clone();
      sphere.isPickable = false;

      // Dispose after lifetime
      setTimeout(() => {
        try {
          sphere.dispose();
          mat.dispose();
        } catch (_e) {}
      }, lifetimeMs);
    } catch (_e) {
      // ignore in environments without full Babylon capabilities
    }
  }

  private getOrCreateParticleSystem(): ParticleSystem | null {
    console.log('🔄 [PARTICLE_SYSTEM] Pool status:', {
      poolSize: this.particlePool.length,
      activeSize: this.activeParticleSystems.size,
      maxActive: 10,
    });
    if (this.debugAlwaysCreateNew) {
      console.log(
        '⚠️ [PARTICLE_SYSTEM] Debug mode: always create NEW particle system (pool disabled)'
      );
      if (this.activeParticleSystems.size < 100) {
        const particleSystem = new ParticleSystem(
          `impact_particles_${Date.now()}_${Math.random()}`,
          1000,
          this.scene
        );

        // Basic configuration to ensure visibility
        particleSystem.emitRate = 100;
        particleSystem.minLifeTime = 1.0;
        particleSystem.maxLifeTime = 3.0;
        particleSystem.minSize = 0.1;
        particleSystem.maxSize = 0.3;
        particleSystem.color1 = new Color4(1, 1, 0, 1);
        particleSystem.color2 = new Color4(1, 0.5, 0, 1);

        particleSystem.emitter = new Vector3(0, 1, 0);
        particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
        particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
        try {
          (
            this.scene as unknown as { addParticleSystem?: (ps: ParticleSystem) => void }
          ).addParticleSystem?.(particleSystem);
        } catch (_e) {}
        this.wrapStopLogger(particleSystem);

        console.log(
          '🆕 [PARTICLE_SYSTEM] (debug) Created NEW particle system with basic config (not started)'
        );
        return particleSystem;
      }
    }
    // Try to reuse from pool if available
    if (this.particlePool.length > 0) {
      let particleSystem: ParticleSystem | undefined;
      while (this.particlePool.length > 0) {
        const candidate = this.particlePool.pop();
        if (candidate) {
          particleSystem = candidate;
          break;
        }
      }

      if (particleSystem) {
        console.log('♻️ [PARTICLE_SYSTEM] Reusing particle system from pool, resetting...');
        try {
          // Reset internal state without invoking stop()
          try {
            particleSystem.reset();
          } catch (_e) {
            // Fallback: if reset fails, call stop as last resort
            try {
              particleSystem.stop();
            } catch (_err) {}
          }

          particleSystem.particleTexture = null;
          particleSystem.emitRate = 0;
          particleSystem.manualEmitCount = 0;

          console.log(
            '✨ [PARTICLE_SYSTEM] System FULLY RESET, ready for reuse',
            particleSystem.name
          );
          this.wrapStopLogger(particleSystem);
          try {
            (
              this.scene as unknown as { addParticleSystem?: (ps: ParticleSystem) => void }
            ).addParticleSystem?.(particleSystem);
          } catch (_e) {}

          return particleSystem;
        } catch (error) {
          console.error('❌ [PARTICLE_SYSTEM] Failed to clean reused system:', error);
          // fallthrough to attempt creation
        }
      } else {
        console.log(
          '♻️ [PARTICLE_SYSTEM] No non-reserved system available in pool, will attempt to create new'
        );
      }
    }

    // Create new if we haven't hit limits
    if (this.activeParticleSystems.size < 100) {
      const particleSystem = new ParticleSystem(
        `impact_particles_${Date.now()}_${Math.random()}`,
        1000,
        this.scene
      );

      // Basic configuration to ensure visibility
      particleSystem.emitRate = 100;
      particleSystem.minLifeTime = 1.0;
      particleSystem.maxLifeTime = 3.0;
      particleSystem.minSize = 0.1;
      particleSystem.maxSize = 0.3;
      particleSystem.color1 = new Color4(1, 1, 0, 1);
      particleSystem.color2 = new Color4(1, 0.5, 0, 1);

      particleSystem.emitter = new Vector3(0, 1, 0);
      particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
      particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
      try {
        (
          this.scene as unknown as { addParticleSystem?: (ps: ParticleSystem) => void }
        ).addParticleSystem?.(particleSystem);
      } catch (_e) {}
      this.wrapStopLogger(particleSystem);

      console.log(
        '🆕 [PARTICLE_SYSTEM] Created NEW particle system with basic config (not started)'
      );
      return particleSystem;
    }

    console.error(
      '🚨 [PARTICLE_SYSTEM] LIMIT REACHED! Cannot create more particle systems - Active:',
      this.activeParticleSystems.size,
      '/100, Pool:',
      this.particlePool.length,
      'Active:',
      this.activeParticleSystems.size
    );
    return null;
  }

  private configureParticleSystem(
    particleSystem: ParticleSystem,
    impactData: ImpactData,
    config: ImpactParticleConfig,
    particleCount: number
  ): void {
    particleSystem.particleTexture = this.getTexture('generic_particle');
    particleSystem.emitter = this.createEmitterAtPosition(impactData.position);

    particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);

    // Convert Vector3 colors to Color4
    particleSystem.color1 = new Color4(
      config.color.x,
      config.color.y,
      config.color.z,
      config.alpha
    );
    particleSystem.color2 = new Color4(
      config.color.x + config.colorVariation.x,
      config.color.y + config.colorVariation.y,
      config.color.z + config.colorVariation.z,
      config.alpha
    );
    particleSystem.colorDead = new Color4(config.color.x, config.color.y, config.color.z, 0);

    particleSystem.minSize = config.size.x * (1 - config.sizeVariation);
    particleSystem.maxSize = config.size.x * (1 + config.sizeVariation);

    particleSystem.minLifeTime = config.lifetime * 0.001 * 2; // Double the lifetime
    particleSystem.maxLifeTime = config.lifetime * 0.001 * 3; // Triple max lifetime

    particleSystem.emitRate = particleCount;
    particleSystem.maxEmitPower = config.velocity.length();
    particleSystem.minEmitPower = config.velocity.length() * 0.5;

    particleSystem.gravity = new Vector3(0, config.gravity, 0);

    const direction = config.velocity.add(config.velocityVariation);
    particleSystem.direction1 = direction.scale(0.5);
    particleSystem.direction2 = direction.scale(1.5);
    // Minimal log for visibility
    try {
      console.log(
        '🔧 [PARTICLE_SYSTEM] Configured system',
        particleSystem.name,
        'emitRate:',
        particleSystem.emitRate
      );
    } catch (_e) {}
  }

  private createEmitterAtPosition(position: Vector3): Vector3 {
    // Use a simple Vector3 emitter to avoid any lifecycle/disposal issues with meshes
    return position.clone();
  }

  private preloadTextures(): void {
    const textureNames = [
      'spark',
      'dust',
      'debris_metal',
      'debris_concrete',
      'debris_wood',
      'debris_glass',
      'generic_particle',
    ];

    for (const name of textureNames) {
      // In a real implementation, these would be actual texture files
      // For now, create procedural textures or use defaults
      this.textureCache.set(name, this.createDefaultTexture(name));
    }
  }

  private createDefaultTexture(name: string): Texture {
    // Create a visible procedural texture for testing
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Create different textures based on name
      ctx.fillStyle = this.getTextureColor(name);
      ctx.fillRect(0, 0, 64, 64);

      // Add a white circle for better visibility
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
    }

    const dataURL = canvas.toDataURL();
    return new Texture(dataURL, this.scene);
  }

  private getTextureColor(name: string): string {
    const colorMap: { [key: string]: string } = {
      spark: '#FF6600',
      dust: '#8B4513',
      debris_metal: '#C0C0C0',
      debris_concrete: '#808080',
      debris_wood: '#8B4513',
      debris_glass: '#E0E0E0',
      generic_particle: '#FFFFFF',
    };

    return colorMap[name] || '#FFFFFF';
  }

  private getTexture(name: string): Texture {
    let tex = this.textureCache.get(name);
    if (!tex) {
      console.warn(
        `⚠️ [PARTICLE_SYSTEM] Texture '${name}' not found in cache, creating default placeholder`
      );
      try {
        tex = this.createDefaultTexture(name);
        this.textureCache.set(name, tex);
        console.log(`🧩 [PARTICLE_SYSTEM] Created placeholder texture for '${name}'`);
      } catch (e) {
        console.error(
          `❌ [PARTICLE_SYSTEM] Failed to create placeholder texture for '${name}':`,
          e
        );
      }
    }

    // Ensure there is at least a generic particle texture
    if (!tex) {
      tex = this.textureCache.get('generic_particle');
      if (!tex) {
        console.warn('⚠️ [PARTICLE_SYSTEM] Generic particle texture missing, creating one now');
        tex = this.createDefaultTexture('generic_particle');
        this.textureCache.set('generic_particle', tex);
      }
    }

    return tex ?? this.createDefaultTexture('generic_particle');
  }

  private getParticleConfigForEffect(
    _effectType: ImpactEffectType,
    materialType: MaterialType
  ): ImpactParticleConfig {
    // Default configuration - expanded for better visual effects
    return {
      count: 30,
      lifetime: 6000, // Extended base lifetime
      size: new Vector3(0.05, 0.05, 0.05),
      sizeVariation: 0.3,
      velocity: new Vector3(0, 2, 0),
      velocityVariation: new Vector3(1, 1, 1),
      acceleration: new Vector3(0, -9.8, 0),
      color: this.getColorForMaterial(materialType),
      colorVariation: new Vector3(0.2, 0.2, 0.2),
      alpha: 1.0,
      alphaDecay: 0.98,
      gravity: -9.8,
      drag: 0.1,
      bounce: 0.3,
    };
  }

  private getColorForMaterial(materialType: MaterialType): Vector3 {
    const colorMap = {
      metal: new Vector3(0.8, 0.8, 0.9),
      concrete: new Vector3(0.7, 0.7, 0.6),
      stone: new Vector3(0.6, 0.6, 0.5),
      wood: new Vector3(0.6, 0.4, 0.2),
      glass: new Vector3(0.9, 0.9, 1.0),
      water: new Vector3(0.4, 0.6, 0.9),
      dirt: new Vector3(0.4, 0.3, 0.2),
      default: new Vector3(0.5, 0.5, 0.5),
    };

    return colorMap[materialType as keyof typeof colorMap] || colorMap.default;
  }

  private getDebrisColors(materialType: MaterialType) {
    const colorMap = {
      metal: {
        primary: new Color4(0.8, 0.8, 0.9, 1.0),
        secondary: new Color4(0.6, 0.6, 0.7, 1.0),
        dead: new Color4(0.4, 0.4, 0.5, 0.0),
      },
      concrete: {
        primary: new Color4(0.7, 0.7, 0.6, 1.0),
        secondary: new Color4(0.5, 0.5, 0.4, 1.0),
        dead: new Color4(0.3, 0.3, 0.2, 0.0),
      },
      wood: {
        primary: new Color4(0.6, 0.4, 0.2, 1.0),
        secondary: new Color4(0.5, 0.3, 0.1, 1.0),
        dead: new Color4(0.3, 0.2, 0.1, 0.0),
      },
    };

    return colorMap[materialType as keyof typeof colorMap] || colorMap.concrete;
  }

  private getDustColorForMaterial(materialType: MaterialType): Color4 {
    const colorMap = {
      concrete: new Color4(0.6, 0.6, 0.5, 0.7),
      stone: new Color4(0.5, 0.5, 0.4, 0.7),
      wood: new Color4(0.4, 0.3, 0.2, 0.6),
      dirt: new Color4(0.3, 0.2, 0.1, 0.8),
      default: new Color4(0.5, 0.5, 0.5, 0.6),
    };

    return colorMap[materialType as keyof typeof colorMap] || colorMap.default;
  }

  private getSizeMultiplierForMaterial(materialType: MaterialType): number {
    const sizeMap = {
      metal: 0.8,
      concrete: 1.2,
      stone: 1.1,
      wood: 1.0,
      glass: 0.6,
      default: 1.0,
    };

    return sizeMap[materialType as keyof typeof sizeMap] || sizeMap.default;
  }

  private calculateReflectionDirection(velocity: Vector3, normal: Vector3): Vector3 {
    // Handle case where velocity might be zero or undefined
    if (!velocity || velocity.length() === 0) {
      // Default reflection direction based on normal
      return normal.scale(-1).normalize();
    }

    const incident = velocity.normalize();
    const reflected = incident.subtract(normal.scale(2 * Vector3.Dot(incident, normal)));
    return reflected.normalize();
  }

  private calculateScatterDirection(normal: Vector3, _surfaceAngle: number): Vector3 {
    // Create scatter cone based on surface angle
    const baseDirection = normal.clone();
    const _randomAngle = Math.random() * Math.PI * 0.5; // 90 degree cone
    const randomAxis = Vector3.Cross(normal, Vector3.Up()).normalize();

    // Rotate around random axis
    baseDirection.rotateByQuaternionAroundPointToRef(
      randomAxis.toQuaternion(),
      Vector3.Zero(),
      baseDirection
    );

    return baseDirection;
  }

  private generateEffectId(): string {
    return `effect_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private cleanupParticleSystem(effectId: string): void {
    console.log('🧹 [PARTICLE_SYSTEM] Cleaning up particle system:', effectId);

    // Clear any active timer for this effect to prevent timer leaks
    const timer = this.particleTimers.get(effectId);
    if (timer) {
      clearTimeout(timer);
      this.particleTimers.delete(effectId);
      console.log('⏰ [PARTICLE_SYSTEM] Cleared monitoring timer for:', effectId);
    }

    const particleSystem = this.activeParticleSystems.get(effectId);
    if (particleSystem) {
      console.log('🔄 [PARTICLE_SYSTEM] Stopping particle system and preparing for reuse');

      // Stop the system
      particleSystem.stop();

      // Remove from active list immediately
      this.activeParticleSystems.delete(effectId);
      console.log(
        '📤 [PARTICLE_SYSTEM] Removed from active list. Active remaining:',
        this.activeParticleSystems.size
      );

      // Return to pool
      this.particlePool.push(particleSystem);
      console.log(
        '✅ [PARTICLE_SYSTEM] System returned to pool. Pool size:',
        this.particlePool.length
      );
    } else {
      console.log(
        '❓ [PARTICLE_SYSTEM] Effect ID not found in active systems:',
        effectId,
        'Current active IDs:',
        Array.from(this.activeParticleSystems.keys())
      );
    }
  }

  /**
   * Setup intelligent cleanup based on particle system lifecycle
   */
  private setupParticleLifecycleCleanup(particleSystem: ParticleSystem, effectId: string): void {
    // Calculate expected total lifetime
    const emissionTime = this.getEmissionTimeForEffect(effectId);
    const maxParticleLifetime = particleSystem.maxLifeTime * 1000; // Convert to ms
    const totalExpectedLifetime = emissionTime + maxParticleLifetime + 2000; // Add 2s buffer

    console.log(
      `⏱️ [PARTICLE_SYSTEM] Setting up cleanup for ${effectId} in ${totalExpectedLifetime}ms`
    );

    // Use a single timer instead of recursive monitoring
    // Capture the particleSystem reference so we can detect if it was
    // reused or the effectId remapped before the cleanup fires.
    const psRef = particleSystem;
    const cleanupTimer = setTimeout(() => {
      try {
        console.log('🏁 [PARTICLE_SYSTEM] Scheduled cleanup triggered for:', effectId);
        // Guard: only cleanup if the currently tracked particle system for
        // this effectId is the same instance we scheduled the timer for.
        const current = this.activeParticleSystems.get(effectId);
        if (!current) {
          // already cleaned up or re-assigned; skip
          console.log(
            '⏭️ [PARTICLE_SYSTEM] Skipping cleanup for',
            effectId,
            '- no active system or re-assigned'
          );
          this.particleTimers.delete(effectId);
          return;
        }
        if (current !== psRef) {
          console.log(
            '⏭️ [PARTICLE_SYSTEM] Skipping cleanup for',
            effectId,
            '- instance mismatch (reused)'
          );
          // Timer belonged to a previous instance that was returned to pool
          this.particleTimers.delete(effectId);
          return;
        }

        // Safe to cleanup the intended system
        this.cleanupParticleSystem(effectId);
      } catch (_e) {
        // ignore errors during cleanup guard
      }
    }, totalExpectedLifetime);

    // Store the timer to prevent leaks
    this.particleTimers.set(effectId, cleanupTimer);
  }

  /**
   * Get emission time based on effect type
   */
  private getEmissionTimeForEffect(_effectId: string): number {
    // Default emission times based on our current system
    return 1000; // 1 second default emission time
  }

  /**
   * Create a small DOM overlay for debugging particle system state when console is not available
   */
  private createDebugOverlay(): void {
    try {
      if (typeof document === 'undefined') return;
      if (this.debugOverlay) return;

      const overlay = document.createElement('div');
      overlay.id = 'impact-particle-debug-overlay';
      overlay.style.position = 'fixed';
      overlay.style.right = '8px';
      overlay.style.top = '8px';
      overlay.style.zIndex = '9999';
      overlay.style.background = 'rgba(0,0,0,0.6)';
      overlay.style.color = '#fff';
      overlay.style.fontSize = '12px';
      overlay.style.padding = '8px';
      overlay.style.borderRadius = '6px';
      // Allow pointer events so the copy button can be used
      overlay.style.pointerEvents = 'auto';
      // Make text selectable and wrapped for easier copy
      overlay.style.userSelect = 'text';
      overlay.style.whiteSpace = 'pre-wrap';
      overlay.style.maxHeight = '40vh';
      overlay.style.overflow = 'auto';
      overlay.style.maxWidth = '260px';
      // create a dedicated content area so buttons are not removed when updating
      const content = document.createElement('div');
      content.id = 'impact-particle-debug-content';
      content.style.pointerEvents = 'none';
      content.style.userSelect = 'text';
      content.style.whiteSpace = 'pre-wrap';
      content.style.maxHeight = '40vh';
      content.style.overflow = 'auto';
      content.innerText = 'Impact Particles: initializing...';

      overlay.appendChild(content);

      document.body.appendChild(overlay);
      this.debugOverlay = overlay;
      this.debugContent = content;

      // Add a small copy button so the user can copy diagnostics easily
      try {
        const btn = document.createElement('button');
        btn.id = 'impact-particle-debug-copy';
        btn.innerText = 'Copier';
        btn.title = 'Copier diagnostics des particules';
        btn.style.marginTop = '6px';
        btn.style.fontSize = '11px';
        btn.style.padding = '4px 6px';
        btn.style.cursor = 'pointer';
        btn.style.pointerEvents = 'auto';
        // Ensure the button doesn't block pointer events for underlying UI too long
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const text = this.buildDebugText();
            const navClip = navigator as Navigator & {
              clipboard?: { writeText?: (t: string) => Promise<void> };
            };
            if (navClip?.clipboard?.writeText) {
              await navClip.clipboard.writeText(text);
              btn.innerText = 'Copié';
              setTimeout(() => {
                btn.innerText = 'Copier';
              }, 1200);
            } else {
              // Fallback: select debug content text
              const range = document.createRange();
              const nodeToSelect = (this.debugContent || this.debugOverlay) as Node;
              range.selectNodeContents(nodeToSelect);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          } catch (err) {
            console.warn('Could not copy diagnostics:', err);
          }
        });
        this.debugOverlay.appendChild(btn);
      } catch (_e) {
        // ignore
      }

      // Add force-visibility button
      try {
        const forceBtn = document.createElement('button');
        forceBtn.id = 'impact-particle-debug-force';
        forceBtn.innerText = 'Forcer visibilité';
        forceBtn.title = 'Augmente temporairement la taille et émet plus de particules';
        forceBtn.style.marginTop = '6px';
        forceBtn.style.marginLeft = '6px';
        forceBtn.style.fontSize = '11px';
        forceBtn.style.padding = '4px 6px';
        forceBtn.style.cursor = 'pointer';
        forceBtn.style.pointerEvents = 'auto';
        forceBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            const lastPS = (globalThis as unknown as Record<string, unknown>)
              .__lastImpactParticleSystem as ParticleSystem | undefined;
            if (!lastPS) return;
            // Temporarily make particles big and emit a burst
            try {
              // store old values
              const oldMin = lastPS.minSize;
              const oldMax = lastPS.maxSize;
              lastPS.minSize = Math.max(0.5, oldMin || 0.5);
              lastPS.maxSize = Math.max(1.0, oldMax || 1.0);
              lastPS.manualEmitCount = Math.max(lastPS.manualEmitCount || 0, 200);
              lastPS.start();
              setTimeout(() => {
                try {
                  lastPS.minSize = oldMin;
                  lastPS.maxSize = oldMax;
                } catch (_err) {}
                try {
                  this.updateDebugOverlay();
                } catch (_err) {}
              }, 1500);
              try {
                this.updateDebugOverlay();
              } catch (_err) {}
            } catch (inner) {
              console.warn('Force visibility failed:', inner);
            }
          } catch (_err) {
            // ignore
          }
        });
        this.debugOverlay.appendChild(forceBtn);
      } catch (_e) {
        // ignore
      }

      // Expose quick global function to force visibility for scripting
      try {
        (globalThis as unknown as Record<string, unknown>).forceShowLastImpact = async () => {
          const lastPS = (globalThis as unknown as Record<string, unknown>)
            .__lastImpactParticleSystem as ParticleSystem | undefined;
          if (!lastPS) return false;
          try {
            const oldMin = lastPS.minSize;
            const oldMax = lastPS.maxSize;
            lastPS.minSize = Math.max(0.5, oldMin || 0.5);
            lastPS.maxSize = Math.max(1.0, oldMax || 1.0);
            lastPS.manualEmitCount = Math.max(lastPS.manualEmitCount || 0, 200);
            lastPS.start();
            setTimeout(() => {
              try {
                lastPS.minSize = oldMin;
                lastPS.maxSize = oldMax;
              } catch (_e) {}
            }, 1500);
            try {
              (globalThis as unknown as Record<string, unknown>).__lastImpactParticleSystem =
                lastPS as unknown as unknown;
            } catch (_e) {}
            return true;
          } catch (_e) {
            return false;
          }
        };
      } catch (_e) {
        // ignore
      }
    } catch (_e) {
      // ignore
    }
  }

  private updateDebugOverlay(): void {
    if (!ImpactParticleSystem.OVERLAY_ENABLED) return;
    try {
      if (!this.debugOverlay) return;
      const sceneCount = (this.scene as unknown as { particleSystems?: unknown[] }).particleSystems
        ?.length
        ? (this.scene as unknown as { particleSystems?: unknown[] }).particleSystems?.length
        : 0;

      this.debugOverlay.innerHTML = `
<div><strong>Impact Particles</strong></div>
<div>Active: ${this.activeParticleSystems.size}</div>
<div>Pool: ${this.particlePool.length}</div>
<div>Scene systems: ${sceneCount}</div>
<div>Timers: ${this.particleTimers.size}</div>
<div>Last manualEmitCount: ${this.lastManualEmitCount}</div>
<div>Last system ts: ${this.lastSystemTimestamp || 'n/a'}</div>
<div>Last system diag: ${
        this.lastSystemDiagnostics ? JSON.stringify(this.lastSystemDiagnostics) : 'n/a'
      }</div>
`;
      // Append runtime info about the actual last particle system if available
      try {
        const lastPS = (globalThis as unknown as Record<string, unknown>)
          .__lastImpactParticleSystem as ParticleSystem | undefined;
        if (lastPS) {
          const internalCount = (lastPS as unknown as { _particles?: unknown[] })._particles
            ? (lastPS as unknown as { _particles: unknown[] })._particles.length
            : 'n/a';
          const runtime = {
            capacity: typeof lastPS.getCapacity === 'function' ? lastPS.getCapacity() : 'n/a',
            internalParticles: internalCount,
            emitterPresent: !!lastPS.emitter,
            isStarted: typeof lastPS.isStarted === 'function' ? lastPS.isStarted() : 'n/a',
            isStopped: (lastPS as unknown as { _stopped?: boolean })._stopped === true,
            debugStopCalls:
              (lastPS as unknown as { __debugStopCalls?: number }).__debugStopCalls || 0,
            lastStopAt:
              (lastPS as unknown as { __lastStopAt?: number | null }).__lastStopAt || null,
            lastStopStack:
              (lastPS as unknown as { __lastStopStack?: string | null }).__lastStopStack || null
                ? String((lastPS as unknown as { __lastStopStack?: string | null }).__lastStopStack)
                    .split('\n')
                    .slice(0, 3)
                    .join(' | ')
                : null,
          };
          this.debugOverlay.innerHTML += `
<div><strong>Runtime last system</strong></div>
<div>capacity: ${runtime.capacity}</div>
<div>internalParticles: ${runtime.internalParticles}</div>
<div>emitterPresent: ${runtime.emitterPresent}</div>
<div>isStarted: ${runtime.isStarted}</div>
<div>isStopped: ${runtime.isStopped}</div>
<div>debugStopCalls: ${runtime.debugStopCalls}</div>
<div>lastStopAt: ${runtime.lastStopAt}</div>
<div>lastStopStack: ${runtime.lastStopStack}</div>
`;
        }
      } catch (_e) {
        // ignore
      }
    } catch (_e) {
      // ignore
    }
  }

  private buildDebugText(): string {
    if (!ImpactParticleSystem.OVERLAY_ENABLED) return '{}';
    const sceneCount = (this.scene as unknown as { particleSystems?: unknown[] }).particleSystems
      ?.length
      ? (this.scene as unknown as { particleSystems?: unknown[] }).particleSystems?.length
      : 0;

    const diag = {
      active: this.activeParticleSystems.size,
      pool: this.particlePool.length,
      sceneSystems: sceneCount,
      timers: this.particleTimers.size,
      timerIds: Array.from(this.particleTimers.keys()),
      lastManualEmitCount: this.lastManualEmitCount,
      lastSystemTimestamp: this.lastSystemTimestamp,
      lastSystemDiagnostics: this.lastSystemDiagnostics,
      lastCreateCallTimestamp: this.lastCreateCallTimestamp,
      lastCreateCallInfo: this.lastCreateCallInfo,
      lastSystemRuntime: (() => {
        try {
          const lastPS = (globalThis as unknown as Record<string, unknown>)
            .__lastImpactParticleSystem as ParticleSystem | undefined;
          if (!lastPS) return null;
          return {
            capacity: typeof lastPS.getCapacity === 'function' ? lastPS.getCapacity() : null,
            internalParticles: (lastPS as unknown as { _particles?: unknown[] })._particles
              ? (lastPS as unknown as { _particles: unknown[] })._particles.length
              : null,
            emitterPresent: !!lastPS.emitter,
            isStarted: typeof lastPS.isStarted === 'function' ? lastPS.isStarted() : null,
            isStopped: (lastPS as unknown as { _stopped?: boolean })._stopped === true,
            debugStopCalls:
              (lastPS as unknown as { __debugStopCalls?: number }).__debugStopCalls || 0,
            lastStopAt:
              (lastPS as unknown as { __lastStopAt?: number | null }).__lastStopAt || null,
          };
        } catch (_e) {
          return null;
        }
      })(),
    };

    return JSON.stringify(diag, null, 2);
  }
}
