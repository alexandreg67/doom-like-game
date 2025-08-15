import { Color3, Scene } from '@babylonjs/core';
import { Logger } from '../utils/logger';
import type { FogConfig, FogSystemState } from './types';

export class FogManager {
  private scene: Scene;
  private fogState: FogSystemState = {
    currentFog: undefined,
    targetFog: undefined,
    transitionProgress: 0,
    transitionDuration: 1000,
  };
  private isTransitionActive = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeFog();
    Logger.info('[FOG] FogManager initialized');
  }

  public setFog(config: FogConfig | undefined, transition = false): void {
    if (!config || !config.enabled) {
      this.disableFog(transition);
      return;
    }

    if (transition) {
      this.startFogTransition(config);
    } else {
      this.applyFogImmediate(config);
    }
  }

  public updateFogTransition(deltaTime: number): void {
    if (!this.isTransitionActive || this.fogState.transitionProgress >= 1) {
      return;
    }

    if (this.fogState.transitionDuration <= 0) {
      Logger.warn(
        '[FOG] Transition duration is zero or negative; completing transition immediately.'
      );
      this.fogState.transitionProgress = 1;
    } else {
      this.fogState.transitionProgress += deltaTime / this.fogState.transitionDuration;
    }

    if (this.fogState.transitionProgress >= 1) {
      this.completeFogTransition();
    } else {
      this.interpolateFog();
    }
  }

  public getFogState(): FogSystemState {
    return { ...this.fogState };
  }

  public isTransitioning(): boolean {
    return this.isTransitionActive;
  }

  private initializeFog(): void {
    this.scene.fogEnabled = false;
    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogColor = new Color3(0.2, 0.2, 0.3);
    this.scene.fogStart = 10;
    this.scene.fogEnd = 100;
    this.scene.fogDensity = 0.1;
  }

  private applyFogImmediate(config: FogConfig): void {
    this.scene.fogEnabled = true;
    this.scene.fogColor = config.color;

    switch (config.mode) {
      case 'linear':
        this.scene.fogMode = Scene.FOGMODE_LINEAR;
        this.scene.fogStart = config.start || 10;
        this.scene.fogEnd = config.end || 100;
        break;

      case 'exponential':
        this.scene.fogMode = Scene.FOGMODE_EXP;
        this.scene.fogDensity = config.density || 0.1;
        break;

      case 'exponential2':
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = config.density || 0.1;
        break;
    }

    this.fogState.currentFog = { ...config };
    Logger.debug(
      `[FOG] Applied ${config.mode} fog with color (${config.color.r}, ${config.color.g}, ${config.color.b})`
    );
  }

  private disableFog(transition = false): void {
    if (transition) {
      this.startFogTransition(undefined);
    } else {
      this.scene.fogEnabled = false;
      this.fogState.currentFog = undefined;
      Logger.debug('[FOG] Disabled fog');
    }
  }

  private startFogTransition(targetConfig: FogConfig | undefined): void {
    this.fogState.targetFog = targetConfig;
    this.fogState.transitionProgress = 0;
    this.isTransitionActive = true;

    Logger.debug(
      `[FOG] Started fog transition to ${targetConfig ? targetConfig.mode : 'disabled'}`
    );
  }

  private interpolateFog(): void {
    const { currentFog, targetFog, transitionProgress } = this.fogState;

    if (!targetFog) {
      const alpha = 1 - transitionProgress;
      this.scene.fogColor = this.scene.fogColor.scale(alpha);
      if (transitionProgress >= 0.8) {
        this.scene.fogEnabled = false;
      }
      return;
    }

    if (!currentFog) {
      const alpha = transitionProgress;
      const interpolatedConfig: FogConfig = {
        enabled: targetFog.enabled,
        mode: targetFog.mode,
        color: targetFog.color.scale(alpha),
      };

      // Only add optional properties if they exist in the target
      if (targetFog.density !== undefined) {
        interpolatedConfig.density = targetFog.density * alpha;
      }
      if (targetFog.start !== undefined) {
        interpolatedConfig.start = targetFog.start;
      }
      if (targetFog.end !== undefined) {
        interpolatedConfig.end = targetFog.end;
      }
      this.applyFogImmediate(interpolatedConfig);
      return;
    }

    if (currentFog.mode !== targetFog.mode) {
      if (transitionProgress >= 0.5) {
        this.applyFogImmediate(targetFog);
      }
      return;
    }

    const interpolatedConfig: FogConfig = {
      enabled: true,
      mode: targetFog.mode,
      color: Color3.Lerp(currentFog.color, targetFog.color, transitionProgress),
    };

    if (targetFog.mode === 'linear') {
      if (currentFog.start !== undefined && targetFog.start !== undefined) {
        interpolatedConfig.start =
          currentFog.start + (targetFog.start - currentFog.start) * transitionProgress;
      } else if (targetFog.start !== undefined) {
        interpolatedConfig.start = targetFog.start;
      }

      if (currentFog.end !== undefined && targetFog.end !== undefined) {
        interpolatedConfig.end =
          currentFog.end + (targetFog.end - currentFog.end) * transitionProgress;
      } else if (targetFog.end !== undefined) {
        interpolatedConfig.end = targetFog.end;
      }
    } else {
      if (currentFog.density !== undefined && targetFog.density !== undefined) {
        interpolatedConfig.density =
          currentFog.density + (targetFog.density - currentFog.density) * transitionProgress;
      } else if (targetFog.density !== undefined) {
        interpolatedConfig.density = targetFog.density;
      }
    }

    this.applyFogImmediate(interpolatedConfig);
  }

  private completeFogTransition(): void {
    const { targetFog } = this.fogState;

    if (targetFog) {
      this.applyFogImmediate(targetFog);
    } else {
      this.scene.fogEnabled = false;
      this.fogState.currentFog = undefined;
    }

    this.fogState.targetFog = undefined;
    this.fogState.transitionProgress = 0;
    this.isTransitionActive = false;

    Logger.debug('[FOG] Completed fog transition');
  }
}
