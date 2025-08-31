/**
 * Impact Renderer - Handles visual rendering of weapon impacts
 */

import {
  Animation,
  Color3,
  DynamicTexture,
  type Light,
  Mesh,
  PointLight,
  type Scene,
  StandardMaterial,
  type Texture,
  Vector3,
} from '@babylonjs/core';
import type { ImpactData, ImpactDecalConfig, MaterialType } from './impact-types';

export class ImpactRenderer {
  private scene: Scene;
  private decalPool: Mesh[] = [];
  private activeDecals: Map<string, Mesh> = new Map();
  private flashLights: Map<string, Light> = new Map();
  private decalMaterials: Map<string, StandardMaterial> = new Map();

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeDecalMaterials();
  }

  /**
   * Create bullet hole decal at impact point
   */
  public createBulletHole(
    impactData: ImpactData,
    size = 0.05,
    lifetime = 10000 // 10 seconds
  ): string {
    const decalConfig: ImpactDecalConfig = {
      size: new Vector3(size, size, size),
      sizeVariation: 0.2,
      lifetime,
      texture: this.getBulletHoleTexture(impactData.materialType),
      color: this.getBulletHoleColor(impactData.materialType),
      opacity: 0.8,
      fadeRate: 0.01,
      depthBias: 0.001,
      maxAngle: Math.PI / 2 + 0.1, // Allow decals on walls
      growthTime: 100,
      fadeTime: lifetime > 0 ? lifetime * 0.1 : 0,
    };

    return this.createDecal(impactData, decalConfig, 'bullet_hole');
  }

  /**
   * Create scorch mark for explosive impacts
   */
  public createScorchMark(impactData: ImpactData, radius = 0.3): string {
    const decalConfig: ImpactDecalConfig = {
      size: new Vector3(radius, radius, radius),
      sizeVariation: 0.3,
      lifetime: -1, // Permanent
      texture: 'scorch_mark',
      color: new Color3(0.2, 0.1, 0.05),
      opacity: 0.6,
      fadeRate: 0.001,
      depthBias: 0.002,
      maxAngle: Math.PI / 4, // 45 degrees
      growthTime: 500,
      fadeTime: 0,
    };

    return this.createDecal(impactData, decalConfig, 'scorch');
  }

  /**
   * Create muzzle flash light effect
   */
  public createMuzzleFlash(
    position: Vector3,
    _direction: Vector3,
    intensity = 2.0,
    color: Color3 = new Color3(1, 0.8, 0.4)
  ): string {
    const light = new PointLight(`muzzle_flash_${Date.now()}`, position, this.scene);
    light.intensity = intensity;
    light.diffuse = color;
    light.specular = color;
    light.range = 10;

    const flashId = this.generateEffectId();
    this.flashLights.set(flashId, light);

    // Animate flash intensity
    const _fadeAnimation = Animation.CreateAndStartAnimation(
      'flash_fade',
      light,
      'intensity',
      30, // 30 fps
      10, // 10 frames = 1/3 second
      intensity,
      0,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        light.dispose();
        this.flashLights.delete(flashId);
      }
    );

    return flashId;
  }

  /**
   * Create impact flash (brief light at hit point)
   */
  public createImpactFlash(impactData: ImpactData, materialType: MaterialType): string {
    const flashConfig = this.getFlashConfigForMaterial(materialType);
    const position = impactData.position.add(impactData.normal.scale(0.01));

    const light = new PointLight(`impact_flash_${Date.now()}`, position, this.scene);
    light.intensity = flashConfig.intensity;
    light.diffuse = flashConfig.color;
    light.specular = flashConfig.color;
    light.range = flashConfig.range;

    const flashId = this.generateEffectId();
    this.flashLights.set(flashId, light);

    // Very quick flash
    setTimeout(() => {
      if (this.flashLights.has(flashId)) {
        light.dispose();
        this.flashLights.delete(flashId);
      }
    }, flashConfig.duration);

    return flashId;
  }

  /**
   * Create crack pattern for brittle materials
   */
  public createCrackPattern(impactData: ImpactData, severity = 1.0): string {
    const size = 0.1 * severity;
    const decalConfig: ImpactDecalConfig = {
      size: new Vector3(size, size, size),
      sizeVariation: 0.4,
      lifetime: -1, // Permanent cracks
      texture: 'crack_pattern',
      color: new Color3(0.3, 0.3, 0.3),
      opacity: 0.7,
      fadeRate: 0,
      depthBias: 0.0005,
      maxAngle: Math.PI / 6, // 30 degrees - cracks only on relatively flat surfaces
      growthTime: 200,
      fadeTime: 0,
    };

    return this.createDecal(impactData, decalConfig, 'crack');
  }

  /**
   * Create ricochet spark trail
   */
  public createRicochetTrail(
    startPosition: Vector3,
    endPosition: Vector3,
    _intensity = 1.0
  ): string {
    // Create a line mesh for the ricochet trail
    const trailPoints = [startPosition, endPosition];
    const trail = Mesh.CreateLines('ricochet_trail', trailPoints, this.scene, false);

    // Create glowing material
    const material = new StandardMaterial('ricochet_material', this.scene);
    material.emissiveColor = new Color3(1, 0.8, 0.2);
    material.alpha = 0.8;
    trail.material = material;

    const trailId = this.generateEffectId();

    // Animate fade out
    const _fadeAnimation = Animation.CreateAndStartAnimation(
      'trail_fade',
      material,
      'alpha',
      60, // 60 fps
      30, // 30 frames = 0.5 second
      0.8,
      0,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        trail.dispose();
        material.dispose();
      }
    );

    return trailId;
  }

  /**
   * Remove specific decal/effect
   */
  public removeEffect(effectId: string): void {
    // Remove decal
    const decal = this.activeDecals.get(effectId);
    if (decal) {
      this.returnDecalToPool(decal);
      this.activeDecals.delete(effectId);
    }

    // Remove light
    const light = this.flashLights.get(effectId);
    if (light) {
      light.dispose();
      this.flashLights.delete(effectId);
    }
  }

  /**
   * Get statistics about active effects
   */
  public getStats() {
    return {
      activeDecals: this.activeDecals.size,
      activeLights: this.flashLights.size,
      pooledDecals: this.decalPool.length,
    };
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    // Dispose active decals
    for (const decal of this.activeDecals.values()) {
      decal.dispose();
    }
    this.activeDecals.clear();

    // Dispose pooled decals
    for (const decal of this.decalPool) {
      decal.dispose();
    }
    this.decalPool = [];

    // Dispose lights
    for (const light of this.flashLights.values()) {
      light.dispose();
    }
    this.flashLights.clear();

    // Dispose materials
    for (const material of this.decalMaterials.values()) {
      material.dispose();
    }
    this.decalMaterials.clear();
  }

  private createDecal(impactData: ImpactData, config: ImpactDecalConfig, type: string): string {
    console.log('[IMPACT_RENDERER] Creating decal:', {
      type,
      position: impactData.position,
      normal: impactData.normal,
      surfaceAngle: this.getSurfaceAngle(impactData.normal),
      maxAngle: config.maxAngle,
    });

    // Check if surface angle is suitable for decal
    const surfaceAngle = this.getSurfaceAngle(impactData.normal);
    if (surfaceAngle > config.maxAngle) {
      console.log(
        '[IMPACT_RENDERER] Skipping decal - surface too steep:',
        surfaceAngle,
        '>',
        config.maxAngle
      );
      return ''; // Skip decal on steep surfaces
    }

    const decal = this.getOrCreateDecal();
    if (!decal) {
      console.log('[IMPACT_RENDERER] Failed to create/get decal mesh');
      return '';
    }

    console.log('[IMPACT_RENDERER] Created decal mesh:', decal.name);

    // Enable and show the decal
    decal.setEnabled(true);
    decal.isVisible = true;

    // Position decal slightly above surface to prevent z-fighting
    const position = impactData.position.add(impactData.normal.scale(0.01)); // Increased offset
    decal.position = position;

    // Orient decal to surface (make it face away from surface)
    decal.lookAt(position.add(impactData.normal));

    // Scale decal - make it bigger and more visible for testing
    const size = config.size.x * (1 + (Math.random() - 0.5) * config.sizeVariation) * 2; // Double size for visibility
    decal.scaling = new Vector3(size, size, size);

    // Apply material
    const material = this.getDecalMaterial(config.texture);
    material.diffuseColor = config.color;
    material.alpha = config.opacity;
    decal.material = material;

    console.log('[IMPACT_RENDERER] Decal configured:', {
      position: decal.position,
      scaling: decal.scaling,
      material: material.name,
      color: material.diffuseColor,
      alpha: material.alpha,
      enabled: decal.isEnabled(),
      visible: decal.isVisible,
    });

    const decalId = this.generateEffectId();
    this.activeDecals.set(decalId, decal);

    // Handle growth animation
    if (config.growthTime && config.growthTime > 0) {
      decal.scaling = Vector3.Zero();
      Animation.CreateAndStartAnimation(
        'decal_growth',
        decal,
        'scaling',
        60,
        Math.floor(config.growthTime / 16.67), // Convert ms to frames at 60fps
        Vector3.Zero(),
        new Vector3(size, size, size),
        Animation.ANIMATIONLOOPMODE_CONSTANT
      );
    }

    // Handle lifetime
    if (config.lifetime > 0) {
      setTimeout(() => {
        this.fadeOutDecal(decalId, config.fadeTime || 1000);
      }, config.lifetime);
    }

    return decalId;
  }

  private getOrCreateDecal(): Mesh | null {
    // Try to reuse from pool
    if (this.decalPool.length > 0) {
      const decal = this.decalPool.pop();
      if (decal) {
        decal.setEnabled(true);
        console.log('[IMPACT_RENDERER] Reusing decal from pool:', decal.name);
        return decal;
      }
    }

    // Create new decal if under limit
    if (this.activeDecals.size < 100) {
      // Max 100 active decals - create a plane instead of ground for better visibility
      const decal = Mesh.CreatePlane('impact_decal', 1, this.scene);
      decal.billboardMode = Mesh.BILLBOARDMODE_NONE; // Don't billboard, we want it flat on surface
      console.log('[IMPACT_RENDERER] Created new decal mesh:', decal.name);
      return decal;
    }

    console.log('[IMPACT_RENDERER] Decal limit reached, cannot create more');
    return null;
  }

  private returnDecalToPool(decal: Mesh): void {
    decal.setEnabled(false);
    decal.position = Vector3.Zero();
    decal.rotation = Vector3.Zero();
    decal.scaling = Vector3.One();
    this.decalPool.push(decal);
  }

  private fadeOutDecal(decalId: string, fadeTime: number): void {
    const decal = this.activeDecals.get(decalId);
    if (!decal || !decal.material) {
      return;
    }

    const material = decal.material as StandardMaterial;
    const startAlpha = material.alpha;

    Animation.CreateAndStartAnimation(
      'decal_fadeout',
      material,
      'alpha',
      60,
      Math.floor(fadeTime / 16.67),
      startAlpha,
      0,
      Animation.ANIMATIONLOOPMODE_CONSTANT,
      undefined,
      () => {
        this.removeEffect(decalId);
      }
    );
  }

  private initializeDecalMaterials(): void {
    // Create base materials for different decal types
    const bulletHoleMaterial = new StandardMaterial('bullet_hole_material', this.scene);
    bulletHoleMaterial.diffuseTexture = this.createBulletHoleTexture();
    bulletHoleMaterial.useAlphaFromDiffuseTexture = true;
    this.decalMaterials.set('bullet_hole', bulletHoleMaterial);

    const scorchMaterial = new StandardMaterial('scorch_material', this.scene);
    scorchMaterial.diffuseTexture = this.createScorchTexture();
    scorchMaterial.useAlphaFromDiffuseTexture = true;
    this.decalMaterials.set('scorch_mark', scorchMaterial);

    const crackMaterial = new StandardMaterial('crack_material', this.scene);
    crackMaterial.diffuseTexture = this.createCrackTexture();
    crackMaterial.useAlphaFromDiffuseTexture = true;
    this.decalMaterials.set('crack_pattern', crackMaterial);
  }

  private getDecalMaterial(textureName: string): StandardMaterial {
    const material = this.decalMaterials.get(textureName);
    if (material) return material;
    const fallback = this.decalMaterials.get('bullet_hole');
    if (fallback) return fallback;
    // Fallback to a basic material to satisfy lints and avoid null assertions
    return new StandardMaterial('fallback_decal_material', this.scene);
  }

  private createBulletHoleTexture(): Texture {
    // Create procedural bullet hole texture
    const size = 64;
    const dynamicTexture = new DynamicTexture('bullet_hole_texture', size, this.scene);
    const context = dynamicTexture.getContext();

    if (context) {
      // Draw black circle with rough edges
      context.fillStyle = '#000000';
      context.beginPath();
      context.arc(size / 2, size / 2, size / 3, 0, 2 * Math.PI);
      context.fill();

      dynamicTexture.update();
    }
    return dynamicTexture;
  }

  private createScorchTexture(): Texture {
    // Create procedural scorch mark texture
    const size = 128;
    const dynamicTexture = new DynamicTexture('scorch_texture', size, this.scene);
    const context = dynamicTexture.getContext();

    if (context) {
      // Draw irregular dark pattern
      const gradient = context.createRadialGradient(
        size / 2,
        size / 2,
        0,
        size / 2,
        size / 2,
        size / 2
      );
      gradient.addColorStop(0, 'rgba(20, 10, 5, 0.8)');
      gradient.addColorStop(0.7, 'rgba(40, 20, 10, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      context.fillStyle = gradient;
      context.fillRect(0, 0, size, size);

      dynamicTexture.update();
    }
    return dynamicTexture;
  }

  private createCrackTexture(): Texture {
    // Create procedural crack pattern texture
    const size = 64;
    const dynamicTexture = new DynamicTexture('crack_texture', size, this.scene);
    const context = dynamicTexture.getContext();

    if (context) {
      // Draw crack lines
      context.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(size / 2, 0);
      context.lineTo(size / 2, size);
      context.moveTo(0, size / 2);
      context.lineTo(size, size / 2);
      context.stroke();

      dynamicTexture.update();
    }
    return dynamicTexture;
  }

  private getBulletHoleTexture(materialType: MaterialType): string {
    // Different bullet hole patterns for different materials
    const textureMap = {
      metal: 'bullet_hole', // Clean round holes
      concrete: 'bullet_hole', // Rough holes
      wood: 'bullet_hole', // Splintered holes
      glass: 'bullet_hole', // Spider web cracks
      default: 'bullet_hole',
    };

    return textureMap[materialType as keyof typeof textureMap] || textureMap.default;
  }

  private getBulletHoleColor(materialType: MaterialType): Color3 {
    const colorMap = {
      metal: new Color3(0.2, 0.2, 0.2),
      concrete: new Color3(0.3, 0.3, 0.3),
      wood: new Color3(0.4, 0.2, 0.1),
      glass: new Color3(0.8, 0.8, 0.9),
      default: new Color3(0.2, 0.2, 0.2),
    };

    return colorMap[materialType as keyof typeof colorMap] || colorMap.default;
  }

  private getFlashConfigForMaterial(materialType: MaterialType) {
    const configs = {
      metal: {
        intensity: 3.0,
        color: new Color3(1, 0.9, 0.7),
        range: 8,
        duration: 50,
      },
      concrete: {
        intensity: 1.5,
        color: new Color3(0.9, 0.8, 0.6),
        range: 5,
        duration: 80,
      },
      wood: {
        intensity: 1.0,
        color: new Color3(0.8, 0.6, 0.4),
        range: 4,
        duration: 60,
      },
      glass: {
        intensity: 2.0,
        color: new Color3(0.9, 0.9, 1.0),
        range: 6,
        duration: 40,
      },
      default: {
        intensity: 1.5,
        color: new Color3(1, 0.8, 0.6),
        range: 5,
        duration: 60,
      },
    };

    return configs[materialType as keyof typeof configs] || configs.default;
  }

  private getSurfaceAngle(normal: Vector3): number {
    return Math.acos(Vector3.Dot(normal, Vector3.Up()));
  }

  private generateEffectId(): string {
    return `render_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
