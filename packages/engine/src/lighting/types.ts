import type {
  Color3,
  DirectionalLight,
  HemisphericLight,
  PointLight,
  ShadowGenerator,
  SpotLight,
  Vector3,
} from '@babylonjs/core';

export type LightType = 'directional' | 'point' | 'spot' | 'hemispheric';

export interface LightConfig {
  id: string;
  type: LightType;
  position?: Vector3;
  direction?: Vector3;
  color: Color3;
  intensity: number;
  range?: number;
  angle?: number;
  exponent?: number;
  shadows?: ShadowConfig;
  enabled: boolean;
}

export interface ShadowConfig {
  enabled: boolean;
  mapSize: number;
  bias: number;
  darkness: number;
  useBlurExponentialShadowMap?: boolean;
  blurKernel?: number;
}

export interface FogConfig {
  enabled: boolean;
  mode: 'linear' | 'exponential' | 'exponential2';
  color: Color3;
  density?: number;
  start?: number;
  end?: number;
}

export interface SectorLightingConfig {
  sectorId: string;
  ambient: {
    color: Color3;
    intensity: number;
  };
  lights: string[];
  fog?: FogConfig;
  transitions?: LightTransition[];
}

export interface LightTransition {
  toSectorId: string;
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface LightingSystemConfig {
  globalAmbient: {
    color: Color3;
    intensity: number;
  };
  lights: LightConfig[];
  sectorLighting: SectorLightingConfig[];
  performance: {
    maxActiveLights: number;
    shadowMapPoolSize: number;
    cullingDistance: number;
    enableLOD: boolean;
  };
}

export interface LightInstance {
  config: LightConfig;
  babylonLight: DirectionalLight | PointLight | SpotLight | HemisphericLight;
  shadowGenerator: ShadowGenerator | undefined;
  isActive: boolean;
  lastUpdateTime: number;
}

export interface LightingMetrics {
  activeLights: number;
  shadowMapsUsed: number;
  lightCullingTime: number;
  shadowRenderTime: number;
  totalLightingTime: number;
}

export interface FogSystemState {
  currentFog: FogConfig | undefined;
  targetFog: FogConfig | undefined;
  transitionProgress: number;
  transitionDuration: number;
}
