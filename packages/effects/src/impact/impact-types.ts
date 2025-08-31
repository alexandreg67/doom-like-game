/**
 * Types and interfaces for weapon impact system
 */

import type { Color3, Vector3 } from '@babylonjs/core';

// Import Entity type directly to avoid path issues
export interface Entity {
  id: string;
  components: Map<string, any>;
}

/**
 * Material types for impact differentiation
 */
export type MaterialType =
  | 'metal'
  | 'concrete'
  | 'stone'
  | 'wood'
  | 'glass'
  | 'water'
  | 'flesh'
  | 'dirt'
  | 'fabric'
  | 'plastic'
  | 'default';

/**
 * Impact effect types
 */
export type ImpactEffectType =
  | 'sparks'
  | 'debris'
  | 'dust'
  | 'splash'
  | 'shards'
  | 'smoke'
  | 'blood';

/**
 * Audio effect types for impacts
 */
export type ImpactAudioType =
  | 'metallic_ping'
  | 'concrete_crack'
  | 'wood_thud'
  | 'glass_shatter'
  | 'water_splash'
  | 'flesh_impact'
  | 'dirt_puff'
  | 'fabric_tear'
  | 'plastic_snap'
  | 'default_hit';

/**
 * Complete impact configuration
 */
export interface ImpactConfig {
  // Material properties
  materialType: MaterialType;
  hardness: number; // 0-1, affects particle count and sound
  density: number; // affects debris mass

  // Visual effects
  particleEffects: ImpactEffectType[];
  decalEnabled: boolean;
  scorchMarkEnabled: boolean;

  // Audio configuration
  audioType: ImpactAudioType;
  audioVariations: string[];

  // Physics properties
  ricochetChance: number; // 0-1
  penetrationResistance: number;

  // Performance settings
  maxParticles: number;
  particleLifetime: number;
  maxDistance: number; // LOD cutoff distance
}

/**
 * Impact data passed to effect systems
 */
export interface ImpactData {
  // Hit information
  position: Vector3;
  normal: Vector3;
  velocity: Vector3;

  // Surface properties
  materialType: MaterialType;
  surfaceAngle: number; // angle between projectile and surface
  impactForce: number;

  // Weapon information
  weaponType: string;
  damage: number;
  caliber?: number;

  // Entity context
  hitEntity?: Entity;
  sourceEntity?: Entity;

  // Timestamp
  timestamp: number;
}

/**
 * Particle system configuration for impacts
 */
export interface ImpactParticleConfig {
  // Basic properties
  count: number;
  lifetime: number;
  size: Vector3;
  sizeVariation: number;

  // Emission properties
  velocity: Vector3;
  velocityVariation: Vector3;
  acceleration: Vector3;

  // Visual properties
  color: Vector3;
  colorVariation: Vector3;
  alpha: number;
  alphaDecay: number;

  // Physics
  gravity: number;
  drag: number;
  bounce: number;

  // Texture
  texture?: string;
  uvAnimation?: {
    frames: number;
    frameRate: number;
  };
}

/**
 * Decal configuration for persistent impact marks
 */
export interface ImpactDecalConfig {
  // Basic properties
  size: Vector3;
  sizeVariation: number;
  lifetime: number; // -1 for permanent

  // Visual properties
  texture: string;
  color: Color3;
  opacity: number;
  fadeRate: number;

  // Placement
  depthBias: number;
  maxAngle: number; // maximum surface angle for placement

  // Animation
  growthTime?: number;
  fadeTime?: number;
}

/**
 * Audio configuration for impact sounds
 */
export interface ImpactAudioConfig {
  // Sound selection
  samples: string[];
  randomize: boolean;

  // 3D Audio properties
  volume: number;
  pitch: number;
  pitchVariation: number;

  // Spatial properties
  maxDistance: number;
  rolloffFactor: number;
  dopplerFactor: number;

  // Environmental effects
  reverbEnabled: boolean;
  occlusionEnabled: boolean;
}

/**
 * Performance optimization settings
 */
export interface ImpactPerformanceConfig {
  // LOD settings
  highDetailDistance: number;
  mediumDetailDistance: number;
  lowDetailDistance: number;
  cullingDistance: number;

  // Particle limits
  maxParticlesPerImpact: number;
  maxSimultaneousImpacts: number;
  maxDecalsPerSurface: number;

  // Update frequencies
  particleUpdateRate: number;
  audioUpdateRate: number;

  // Memory management
  poolSizes: {
    particles: number;
    decals: number;
    audioSources: number;
  };
}

/**
 * Material configuration database
 */
export interface MaterialDatabase {
  materials: Map<MaterialType, ImpactConfig>;
  defaultMaterial: MaterialType;
}

/**
 * Impact result returned after processing
 */
export interface ImpactResult {
  // Processing status
  success: boolean;
  error?: string;

  // Effects created
  particleSystemsCreated: number;
  decalsCreated: number;
  audioSourcesUsed: number;

  // Performance metrics
  processingTime: number;
  memoryUsed: number;

  // Effect handles for cleanup
  effectIds: string[];
}

/**
 * Impact system statistics
 */
export interface ImpactSystemStats {
  // Counters
  totalImpacts: number;
  impactsByMaterial: Map<MaterialType, number>;
  activeEffects: number;

  // Performance
  averageProcessingTime: number;
  memoryUsage: number;
  frameTime: number;

  // Resource usage
  particlePoolUtilization: number;
  decalPoolUtilization: number;
  audioPoolUtilization: number;
}
