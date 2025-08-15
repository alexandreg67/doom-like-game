import {
  type AbstractMesh,
  DirectionalLight,
  HemisphericLight,
  type Mesh,
  PointLight,
  type Scene,
  ShadowGenerator,
  SpotLight,
  Vector3,
} from '@babylonjs/core';
import { Logger } from '../utils/logger';
import type {
  LightConfig,
  LightInstance,
  LightingMetrics,
  LightingSystemConfig,
  ShadowConfig,
} from './types';

export class LightManager {
  private scene: Scene;
  private lights: Map<string, LightInstance> = new Map();
  private shadowGenerators: Map<string, ShadowGenerator> = new Map();
  private metrics: LightingMetrics = {
    activeLights: 0,
    shadowMapsUsed: 0,
    lightCullingTime: 0,
    shadowRenderTime: 0,
    totalLightingTime: 0,
  };
  private config: LightingSystemConfig['performance'] = {
    maxActiveLights: 8,
    shadowMapPoolSize: 4,
    cullingDistance: 50,
    enableLOD: true,
  };

  constructor(scene: Scene) {
    this.scene = scene;
    Logger.info('[LIGHTING] LightManager initialized');
  }

  public addLight(config: LightConfig): void {
    if (this.lights.has(config.id)) {
      Logger.warn(`[LIGHTING] Light with id '${config.id}' already exists`);
      return;
    }

    const babylonLight = this.createBabylonLight(config);
    if (!babylonLight) {
      Logger.error(`[LIGHTING] Failed to create light '${config.id}'`);
      return;
    }

    const lightInstance: LightInstance = {
      config,
      babylonLight,
      shadowGenerator: undefined,
      isActive: config.enabled,
      lastUpdateTime: performance.now(),
    };

    if (config.shadows?.enabled) {
      lightInstance.shadowGenerator = this.createShadowGenerator(babylonLight, config.shadows);
    }

    this.lights.set(config.id, lightInstance);
    this.updateLightProperties(lightInstance);

    Logger.info(`[LIGHTING] Added ${config.type} light '${config.id}'`);
  }

  public removeLight(lightId: string): void {
    const light = this.lights.get(lightId);
    if (!light) {
      Logger.warn(`[LIGHTING] Light '${lightId}' not found`);
      return;
    }

    // Decrement shadow maps counter if this light had shadows
    if (light.shadowGenerator) {
      light.shadowGenerator.dispose();
      this.metrics.shadowMapsUsed = Math.max(0, this.metrics.shadowMapsUsed - 1);
    }

    light.babylonLight.dispose();
    this.lights.delete(lightId);

    Logger.info(`[LIGHTING] Removed light '${lightId}'`);
  }

  public updateLight(lightId: string, updates: Partial<LightConfig>): void {
    const light = this.lights.get(lightId);
    if (!light) {
      Logger.warn(`[LIGHTING] Light '${lightId}' not found for update`);
      return;
    }

    Object.assign(light.config, updates);
    this.updateLightProperties(light);
    light.lastUpdateTime = performance.now();

    Logger.debug(`[LIGHTING] Updated light '${lightId}'`);
  }

  public setLightEnabled(lightId: string, enabled: boolean): void {
    const light = this.lights.get(lightId);
    if (!light) {
      Logger.warn(`[LIGHTING] Light '${lightId}' not found`);
      return;
    }

    light.config.enabled = enabled;
    light.isActive = enabled;
    light.babylonLight.setEnabled(enabled);
    light.lastUpdateTime = performance.now();
  }

  public getLight(lightId: string): LightInstance | undefined {
    return this.lights.get(lightId);
  }

  public getAllLights(): Map<string, LightInstance> {
    return new Map(this.lights);
  }

  public addShadowCaster(lightId: string, mesh: AbstractMesh): void {
    const light = this.lights.get(lightId);
    if (!light?.shadowGenerator) {
      Logger.warn(`[LIGHTING] No shadow generator for light '${lightId}'`);
      return;
    }

    light.shadowGenerator.addShadowCaster(mesh);
  }

  public addShadowReceiver(lightId: string, mesh: Mesh): void {
    const light = this.lights.get(lightId);
    if (!light?.shadowGenerator) {
      Logger.warn(`[LIGHTING] No shadow generator for light '${lightId}'`);
      return;
    }

    mesh.receiveShadows = true;
  }

  public updateCulling(cameraPosition: Vector3): void {
    const startTime = performance.now();
    let activeLights = 0;

    for (const [_lightId, light] of this.lights) {
      if (!light.config.enabled) {
        light.isActive = false;
        light.babylonLight.setEnabled(false);
        continue;
      }

      const shouldBeActive = this.shouldLightBeActive(light, cameraPosition);

      if (light.isActive !== shouldBeActive) {
        light.isActive = shouldBeActive;
        light.babylonLight.setEnabled(shouldBeActive);
      }

      if (shouldBeActive) {
        activeLights++;
      }
    }

    this.metrics.activeLights = activeLights;
    this.metrics.lightCullingTime = performance.now() - startTime;
  }

  public getMetrics(): LightingMetrics {
    return { ...this.metrics };
  }

  public setPerformanceConfig(config: Partial<LightingSystemConfig['performance']>): void {
    Object.assign(this.config, config);
    Logger.info('[LIGHTING] Updated performance config:', this.config);
  }

  public dispose(): void {
    for (const [_lightId, light] of this.lights) {
      light.shadowGenerator?.dispose();
      light.babylonLight.dispose();
    }
    this.lights.clear();
    this.shadowGenerators.clear();
    Logger.info('[LIGHTING] LightManager disposed');
  }

  private createBabylonLight(
    config: LightConfig
  ): DirectionalLight | PointLight | SpotLight | HemisphericLight | null {
    switch (config.type) {
      case 'directional':
        return new DirectionalLight(
          config.id,
          config.direction || new Vector3(0, -1, 0),
          this.scene
        );

      case 'point':
        return new PointLight(config.id, config.position || Vector3.Zero(), this.scene);

      case 'spot':
        return new SpotLight(
          config.id,
          config.position || Vector3.Zero(),
          config.direction || new Vector3(0, -1, 0),
          config.angle || Math.PI / 3,
          config.exponent || 2,
          this.scene
        );

      case 'hemispheric':
        return new HemisphericLight(
          config.id,
          config.direction || new Vector3(0, 1, 0),
          this.scene
        );

      default:
        Logger.error(`[LIGHTING] Unknown light type: ${config.type}`);
        return null;
    }
  }

  private lightSupportsShadows(
    light: DirectionalLight | PointLight | SpotLight | HemisphericLight
  ): light is DirectionalLight | PointLight | SpotLight {
    return (
      light instanceof DirectionalLight || light instanceof SpotLight || light instanceof PointLight
    );
  }

  private createShadowGenerator(
    light: DirectionalLight | PointLight | SpotLight | HemisphericLight,
    shadowConfig: ShadowConfig
  ): ShadowGenerator | undefined {
    if (light instanceof HemisphericLight) {
      Logger.warn('[LIGHTING] HemisphericLight does not support shadows');
      return undefined;
    }

    if (!this.lightSupportsShadows(light)) {
      Logger.warn('[LIGHTING] Light type does not support shadows');
      return undefined;
    }

    const shadowGenerator = new ShadowGenerator(shadowConfig.mapSize, light);
    shadowGenerator.bias = shadowConfig.bias;
    shadowGenerator.darkness = shadowConfig.darkness;

    if (shadowConfig.useBlurExponentialShadowMap) {
      shadowGenerator.useBlurExponentialShadowMap = true;
      if (shadowConfig.blurKernel) {
        shadowGenerator.blurKernel = shadowConfig.blurKernel;
      }
    }

    this.metrics.shadowMapsUsed++;
    return shadowGenerator;
  }

  private updateLightProperties(light: LightInstance): void {
    const { config, babylonLight } = light;

    babylonLight.diffuse = config.color;
    babylonLight.intensity = config.intensity;
    babylonLight.setEnabled(config.enabled);

    if (config.position && 'position' in babylonLight) {
      babylonLight.position = config.position;
    }

    if (config.direction && 'direction' in babylonLight) {
      babylonLight.direction = config.direction;
    }

    if (config.range && 'range' in babylonLight) {
      babylonLight.range = config.range;
    }

    if (config.angle && babylonLight instanceof SpotLight) {
      babylonLight.angle = config.angle;
    }

    if (config.exponent && babylonLight instanceof SpotLight) {
      babylonLight.exponent = config.exponent;
    }
  }

  private shouldLightBeActive(light: LightInstance, cameraPosition: Vector3): boolean {
    if (!this.config.enableLOD) {
      return true;
    }

    if (light.config.type === 'directional' || light.config.type === 'hemispheric') {
      return true;
    }

    if (!light.config.position) {
      return true;
    }

    const distance = Vector3.Distance(cameraPosition, light.config.position);
    const maxDistance = light.config.range || this.config.cullingDistance;

    return distance <= maxDistance;
  }
}
