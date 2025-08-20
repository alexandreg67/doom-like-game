/**
 * Particle System for Impact Effects using Babylon.js
 */

import { 
  ParticleSystem, 
  Vector3, 
  Color4, 
  Texture,
  Scene,
  Mesh,
  Animation,
  AnimationKeys
} from '@babylonjs/core';
import type { 
  ImpactData, 
  ImpactParticleConfig, 
  MaterialType, 
  ImpactEffectType 
} from '../impact/impact-types';

export class ImpactParticleSystem {
  private scene: Scene;
  private particlePool: ParticleSystem[] = [];
  private activeParticleSystems: Map<string, ParticleSystem> = new Map();
  private textureCache: Map<string, Texture> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    this.preloadTextures();
  }

  /**
   * Create impact particles based on material and effect type
   */
  public createImpactParticles(
    impactData: ImpactData, 
    effectType: ImpactEffectType, 
    particleCount: number
  ): string {
    const config = this.getParticleConfigForEffect(effectType, impactData.materialType);
    const particleSystem = this.getOrCreateParticleSystem();
    
    if (!particleSystem) {
      throw new Error('Unable to create particle system');
    }

    // Configure particle system
    this.configureParticleSystem(particleSystem, impactData, config, particleCount);
    
    // Generate unique ID for this effect
    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);
    
    // Start the particle system
    particleSystem.start();
    
    // Schedule cleanup
    setTimeout(() => {
      this.cleanupParticleSystem(effectId);
    }, config.lifetime);
    
    return effectId;
  }

  /**
   * Create sparks effect for metal impacts
   */
  public createSparks(impactData: ImpactData, intensity: number = 1.0): string {
    const particleSystem = this.getOrCreateParticleSystem();
    if (!particleSystem) {
      throw new Error('Unable to create spark particle system');
    }

    // Configure for sparks
    particleSystem.particleTexture = this.getTexture('spark');
    particleSystem.emitter = this.createEmitterAtPosition(impactData.position);
    
    // Spark-specific properties
    particleSystem.minEmitBox = new Vector3(-0.1, -0.1, -0.1);
    particleSystem.maxEmitBox = new Vector3(0.1, 0.1, 0.1);
    
    particleSystem.color1 = new Color4(1.0, 0.8, 0.2, 1.0); // Bright yellow
    particleSystem.color2 = new Color4(1.0, 0.4, 0.0, 1.0); // Orange
    particleSystem.colorDead = new Color4(0.5, 0.1, 0.0, 0.0); // Dark red, transparent
    
    particleSystem.minSize = 0.02;
    particleSystem.maxSize = 0.05;
    
    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.8;
    
    particleSystem.emitRate = Math.floor(150 * intensity);
    particleSystem.maxEmitPower = 3.0;
    particleSystem.minEmitPower = 1.5;
    
    // Gravity and physics
    particleSystem.gravity = new Vector3(0, -9.8, 0);
    
    // Direction based on surface normal
    const reflectedDirection = this.calculateReflectionDirection(impactData.velocity, impactData.normal);
    particleSystem.direction1 = reflectedDirection.scale(0.5);
    particleSystem.direction2 = reflectedDirection.scale(1.5);
    
    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);
    
    particleSystem.start();
    
    // Stop emitting after short burst
    setTimeout(() => {
      particleSystem.stop();
    }, 200);
    
    // Cleanup after particles die
    setTimeout(() => {
      this.cleanupParticleSystem(effectId);
    }, 1000);
    
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
    particleSystem.minSize = 0.03 * sizeMultiplier;
    particleSystem.maxSize = 0.08 * sizeMultiplier;
    
    particleSystem.minLifeTime = 1.0;
    particleSystem.maxLifeTime = 3.0;
    
    particleSystem.emitRate = 80;
    particleSystem.maxEmitPower = 2.0;
    particleSystem.minEmitPower = 0.5;
    
    // Physics properties
    particleSystem.gravity = new Vector3(0, -9.8, 0);
    
    // Direction influenced by impact angle
    const scatterDirection = this.calculateScatterDirection(impactData.normal, impactData.surfaceAngle);
    particleSystem.direction1 = scatterDirection.scale(0.3);
    particleSystem.direction2 = scatterDirection.scale(1.0);
    
    const effectId = this.generateEffectId();
    this.activeParticleSystems.set(effectId, particleSystem);
    
    particleSystem.start();
    
    setTimeout(() => {
      particleSystem.stop();
    }, 500);
    
    setTimeout(() => {
      this.cleanupParticleSystem(effectId);
    }, 4000);
    
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
    
    particleSystem.minLifeTime = 2.0;
    particleSystem.maxLifeTime = 4.0;
    
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
    
    particleSystem.start();
    
    setTimeout(() => {
      particleSystem.stop();
    }, 1000);
    
    setTimeout(() => {
      this.cleanupParticleSystem(effectId);
    }, 5000);
    
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

  private getOrCreateParticleSystem(): ParticleSystem | null {
    // Try to reuse from pool
    if (this.particlePool.length > 0) {
      const particleSystem = this.particlePool.pop()!;
      particleSystem.reset();
      return particleSystem;
    }
    
    // Create new if pool is empty and we haven't hit limits
    if (this.activeParticleSystems.size < 50) { // Max active systems
      const particleSystem = new ParticleSystem('impact_particles', 1000, this.scene);
      return particleSystem;
    }
    
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
    
    particleSystem.color1 = Color4.FromColor3(config.color, config.alpha);
    particleSystem.color2 = Color4.FromColor3(config.color.add(config.colorVariation), config.alpha);
    particleSystem.colorDead = Color4.FromColor3(config.color, 0);
    
    particleSystem.minSize = config.size.x * (1 - config.sizeVariation);
    particleSystem.maxSize = config.size.x * (1 + config.sizeVariation);
    
    particleSystem.minLifeTime = config.lifetime * 0.001;
    particleSystem.maxLifeTime = config.lifetime * 0.001;
    
    particleSystem.emitRate = particleCount;
    particleSystem.maxEmitPower = config.velocity.length();
    particleSystem.minEmitPower = config.velocity.length() * 0.5;
    
    particleSystem.gravity = new Vector3(0, config.gravity, 0);
    
    const direction = config.velocity.add(config.velocityVariation);
    particleSystem.direction1 = direction.scale(0.5);
    particleSystem.direction2 = direction.scale(1.5);
  }

  private createEmitterAtPosition(position: Vector3): Mesh {
    const emitter = Mesh.CreateBox('particle_emitter', 0.01, this.scene);
    emitter.position = position.clone();
    emitter.isVisible = false;
    return emitter;
  }

  private preloadTextures(): void {
    const textureNames = [
      'spark',
      'dust',
      'debris_metal',
      'debris_concrete',
      'debris_wood',
      'debris_glass',
      'generic_particle'
    ];

    for (const name of textureNames) {
      // In a real implementation, these would be actual texture files
      // For now, create procedural textures or use defaults
      this.textureCache.set(name, this.createDefaultTexture(name));
    }
  }

  private createDefaultTexture(name: string): Texture {
    // Create a simple colored texture as placeholder
    // In production, load actual texture files
    return new Texture('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', this.scene);
  }

  private getTexture(name: string): Texture {
    return this.textureCache.get(name) || this.textureCache.get('generic_particle')!;
  }

  private getParticleConfigForEffect(effectType: ImpactEffectType, materialType: MaterialType): ImpactParticleConfig {
    // Default configuration - would be expanded based on effect and material
    return {
      count: 30,
      lifetime: 2000,
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
      bounce: 0.3
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
      default: new Vector3(0.5, 0.5, 0.5)
    };
    
    return colorMap[materialType] || colorMap.default;
  }

  private getDebrisColors(materialType: MaterialType) {
    const colorMap = {
      metal: {
        primary: new Color4(0.8, 0.8, 0.9, 1.0),
        secondary: new Color4(0.6, 0.6, 0.7, 1.0),
        dead: new Color4(0.4, 0.4, 0.5, 0.0)
      },
      concrete: {
        primary: new Color4(0.7, 0.7, 0.6, 1.0),
        secondary: new Color4(0.5, 0.5, 0.4, 1.0),
        dead: new Color4(0.3, 0.3, 0.2, 0.0)
      },
      wood: {
        primary: new Color4(0.6, 0.4, 0.2, 1.0),
        secondary: new Color4(0.5, 0.3, 0.1, 1.0),
        dead: new Color4(0.3, 0.2, 0.1, 0.0)
      }
    };
    
    return colorMap[materialType as keyof typeof colorMap] || colorMap.concrete;
  }

  private getDustColorForMaterial(materialType: MaterialType): Color4 {
    const colorMap = {
      concrete: new Color4(0.6, 0.6, 0.5, 0.7),
      stone: new Color4(0.5, 0.5, 0.4, 0.7),
      wood: new Color4(0.4, 0.3, 0.2, 0.6),
      dirt: new Color4(0.3, 0.2, 0.1, 0.8),
      default: new Color4(0.5, 0.5, 0.5, 0.6)
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
      default: 1.0
    };
    
    return sizeMap[materialType as keyof typeof sizeMap] || sizeMap.default;
  }

  private calculateReflectionDirection(velocity: Vector3, normal: Vector3): Vector3 {
    const incident = velocity.normalize();
    const reflected = incident.subtract(normal.scale(2 * Vector3.Dot(incident, normal)));
    return reflected.normalize();
  }

  private calculateScatterDirection(normal: Vector3, surfaceAngle: number): Vector3 {
    // Create scatter cone based on surface angle
    const baseDirection = normal.clone();
    const randomAngle = Math.random() * Math.PI * 0.5; // 90 degree cone
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
    const particleSystem = this.activeParticleSystems.get(effectId);
    if (particleSystem) {
      particleSystem.stop();
      
      // Return to pool after cleanup
      setTimeout(() => {
        if (particleSystem.emitter && particleSystem.emitter instanceof Mesh) {
          particleSystem.emitter.dispose();
        }
        this.particlePool.push(particleSystem);
      }, 100);
      
      this.activeParticleSystems.delete(effectId);
    }
  }
}