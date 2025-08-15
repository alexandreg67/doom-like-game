import { Color3, Scene, type Vector3 } from '@babylonjs/core';
import type { DoomSector } from '../geometry/doom-geometry';
import { Logger } from '../utils/logger';
import type { LightManager } from './light-manager';
import type { FogConfig, FogSystemState, LightTransition, SectorLightingConfig } from './types';

export class SectorLightingManager {
  private scene: Scene;
  private lightManager: LightManager;
  private sectorConfigs: Map<string, SectorLightingConfig> = new Map();
  private currentSectorId: string | null = null;
  private fogState: FogSystemState = {
    currentFog: undefined,
    targetFog: undefined,
    transitionProgress: 0,
    transitionDuration: 0,
  };
  private transitionState: {
    isTransitioning: boolean;
    fromSectorId: string | null;
    toSectorId: string | null;
    progress: number;
    duration: number;
    startTime: number;
  } = {
    isTransitioning: false,
    fromSectorId: null,
    toSectorId: null,
    progress: 0,
    duration: 1000,
    startTime: 0,
  };

  constructor(scene: Scene, lightManager: LightManager) {
    this.scene = scene;
    this.lightManager = lightManager;
    Logger.info('[SECTOR-LIGHTING] SectorLightingManager initialized');
  }

  public setSectorConfigs(configs: SectorLightingConfig[]): void {
    this.sectorConfigs.clear();
    for (const config of configs) {
      this.sectorConfigs.set(config.sectorId, config);
    }
    Logger.info(`[SECTOR-LIGHTING] Loaded ${configs.length} sector lighting configurations`);
  }

  public updatePlayerPosition(_position: Vector3, currentSector: DoomSector): void {
    const newSectorId = currentSector.id?.toString() || 'default';

    if (this.currentSectorId !== newSectorId) {
      this.handleSectorTransition(this.currentSectorId, newSectorId);
    }

    if (this.transitionState.isTransitioning) {
      this.updateTransition();
    }
  }

  public applySectorLighting(sectorId: string, immediate = false): void {
    const config = this.sectorConfigs.get(sectorId);
    if (!config) {
      Logger.warn(`[SECTOR-LIGHTING] No lighting config for sector '${sectorId}'`);
      return;
    }

    if (immediate || !this.transitionState.isTransitioning) {
      this.applyLightingConfig(config);
      this.currentSectorId = sectorId;
    }
  }

  public setAmbientLighting(color: Color3, intensity: number): void {
    this.scene.ambientColor = color.scale(intensity);
  }

  public setFog(fogConfig: FogConfig | undefined): void {
    if (!fogConfig || !fogConfig.enabled) {
      this.scene.fogEnabled = false;
      return;
    }

    this.scene.fogEnabled = true;
    this.scene.fogColor = fogConfig.color;

    switch (fogConfig.mode) {
      case 'linear':
        this.scene.fogMode = Scene.FOGMODE_LINEAR;
        this.scene.fogStart = fogConfig.start || 10;
        this.scene.fogEnd = fogConfig.end || 100;
        break;

      case 'exponential':
        this.scene.fogMode = Scene.FOGMODE_EXP;
        this.scene.fogDensity = fogConfig.density || 0.1;
        break;

      case 'exponential2':
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = fogConfig.density || 0.1;
        break;
    }

    Logger.debug(`[SECTOR-LIGHTING] Applied ${fogConfig.mode} fog`);
  }

  public startLightTransition(
    fromSectorId: string | null,
    toSectorId: string,
    transition?: LightTransition
  ): void {
    const toConfig = this.sectorConfigs.get(toSectorId);
    if (!toConfig) {
      Logger.warn(`[SECTOR-LIGHTING] Cannot transition to unknown sector '${toSectorId}'`);
      return;
    }

    const duration = transition?.duration || 1000;

    this.transitionState = {
      isTransitioning: true,
      fromSectorId,
      toSectorId,
      progress: 0,
      duration,
      startTime: performance.now(),
    };

    Logger.debug(
      `[SECTOR-LIGHTING] Starting transition from '${fromSectorId}' to '${toSectorId}' over ${duration}ms`
    );
  }

  public isTransitioning(): boolean {
    return this.transitionState.isTransitioning;
  }

  public getTransitionProgress(): number {
    return this.transitionState.progress;
  }

  public getCurrentSectorId(): string | null {
    return this.currentSectorId;
  }

  public getSectorConfig(sectorId: string): SectorLightingConfig | undefined {
    return this.sectorConfigs.get(sectorId);
  }

  public update(deltaTime: number): void {
    if (this.transitionState.isTransitioning) {
      this.updateTransition();
    }

    if (this.fogState.targetFog && this.fogState.transitionProgress < 1) {
      this.updateFogTransition(deltaTime);
    }
  }

  private handleSectorTransition(fromSectorId: string | null, toSectorId: string): void {
    const fromConfig = fromSectorId ? this.sectorConfigs.get(fromSectorId) : null;
    const toConfig = this.sectorConfigs.get(toSectorId);

    if (!toConfig) {
      Logger.warn(`[SECTOR-LIGHTING] No lighting config for target sector '${toSectorId}'`);
      return;
    }

    const transition = fromConfig?.transitions?.find((t) => t.toSectorId === toSectorId);

    if (transition && fromSectorId) {
      this.startLightTransition(fromSectorId, toSectorId, transition);
    } else {
      this.applySectorLighting(toSectorId, true);
    }
  }

  private updateTransition(): void {
    const elapsed = performance.now() - this.transitionState.startTime;
    this.transitionState.progress = Math.min(elapsed / this.transitionState.duration, 1);

    if (this.transitionState.progress >= 1) {
      this.completeTransition();
    } else {
      this.applyTransitionState();
    }
  }

  private applyTransitionState(): void {
    const { fromSectorId, toSectorId, progress } = this.transitionState;

    if (!toSectorId) return;

    const fromConfig = fromSectorId ? this.sectorConfigs.get(fromSectorId) : null;
    const toConfig = this.sectorConfigs.get(toSectorId);

    if (!toConfig) return;

    const easedProgress = this.applyEasing(progress, 'ease-in-out');

    if (fromConfig) {
      this.interpolateAmbientLighting(fromConfig, toConfig, easedProgress);
      this.interpolateFog(fromConfig.fog, toConfig.fog, easedProgress);
    } else {
      this.applyLightingConfig(toConfig);
    }

    this.updateLightVisibility(fromConfig ?? null, toConfig, easedProgress);
  }

  private completeTransition(): void {
    const { toSectorId } = this.transitionState;

    this.transitionState.isTransitioning = false;

    if (toSectorId) {
      this.applySectorLighting(toSectorId, true);
    }

    Logger.debug(`[SECTOR-LIGHTING] Completed transition to sector '${toSectorId}'`);
  }

  private applyLightingConfig(config: SectorLightingConfig): void {
    this.setAmbientLighting(config.ambient.color, config.ambient.intensity);
    this.setFog(config.fog);

    for (const [lightId, _light] of this.lightManager.getAllLights()) {
      const shouldBeEnabled = config.lights.includes(lightId);
      this.lightManager.setLightEnabled(lightId, shouldBeEnabled);
    }
  }

  private interpolateAmbientLighting(
    from: SectorLightingConfig,
    to: SectorLightingConfig,
    progress: number
  ): void {
    const color = Color3.Lerp(from.ambient.color, to.ambient.color, progress);
    const intensity =
      from.ambient.intensity + (to.ambient.intensity - from.ambient.intensity) * progress;
    this.setAmbientLighting(color, intensity);
  }

  private interpolateFog(
    fromFog: FogConfig | undefined,
    toFog: FogConfig | undefined,
    progress: number
  ): void {
    if (!fromFog && !toFog) return;

    if (!fromFog) {
      this.setFog(toFog);
      return;
    }

    if (!toFog) {
      if (progress >= 0.5) {
        this.setFog(undefined);
      }
      return;
    }

    const interpolatedFog: FogConfig = {
      enabled: toFog.enabled,
      mode: toFog.mode,
      color: Color3.Lerp(fromFog.color, toFog.color, progress),
    };

    // Add optional properties with proper interpolation
    if (fromFog.density !== undefined && toFog.density !== undefined) {
      interpolatedFog.density = fromFog.density + (toFog.density - fromFog.density) * progress;
    } else if (toFog.density !== undefined) {
      interpolatedFog.density = toFog.density;
    }

    if (fromFog.start !== undefined && toFog.start !== undefined) {
      interpolatedFog.start = fromFog.start + (toFog.start - fromFog.start) * progress;
    } else if (toFog.start !== undefined) {
      interpolatedFog.start = toFog.start;
    }

    if (fromFog.end !== undefined && toFog.end !== undefined) {
      interpolatedFog.end = fromFog.end + (toFog.end - fromFog.end) * progress;
    } else if (toFog.end !== undefined) {
      interpolatedFog.end = toFog.end;
    }

    this.setFog(interpolatedFog);
  }

  private updateLightVisibility(
    from: SectorLightingConfig | null,
    to: SectorLightingConfig,
    progress: number
  ): void {
    const fromLights = new Set(from?.lights || []);
    const toLights = new Set(to.lights);

    for (const [lightId] of this.lightManager.getAllLights()) {
      const wasEnabled = fromLights.has(lightId);
      const willBeEnabled = toLights.has(lightId);

      if (wasEnabled === willBeEnabled) {
        continue;
      }

      if (!wasEnabled && willBeEnabled) {
        if (progress >= 0.5) {
          this.lightManager.setLightEnabled(lightId, true);
        }
      } else if (wasEnabled && !willBeEnabled) {
        if (progress >= 0.5) {
          this.lightManager.setLightEnabled(lightId, false);
        }
      }
    }
  }

  private updateFogTransition(deltaTime: number): void {
    if (!this.fogState.targetFog) return;

    if (this.fogState.transitionDuration <= 0) {
      Logger.warn(
        '[SECTOR-LIGHTING] Fog transition duration is zero or negative; completing transition instantly.'
      );
      this.fogState.transitionProgress = 1;
    } else {
      this.fogState.transitionProgress += deltaTime / this.fogState.transitionDuration;
    }

    if (this.fogState.transitionProgress >= 1) {
      this.setFog(this.fogState.targetFog);
      this.fogState.currentFog = this.fogState.targetFog;
      this.fogState.targetFog = undefined;
      this.fogState.transitionProgress = 0;
    }
  }

  private applyEasing(
    progress: number,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  ): number {
    switch (easing) {
      case 'linear':
        return progress;
      case 'ease-in':
        return progress * progress;
      case 'ease-out':
        return 1 - (1 - progress) * (1 - progress);
      case 'ease-in-out':
        return progress < 0.5 ? 2 * progress * progress : 1 - 2 * (1 - progress) * (1 - progress);
      default:
        return progress;
    }
  }
}
