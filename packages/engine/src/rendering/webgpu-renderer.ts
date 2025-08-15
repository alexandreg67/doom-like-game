import { WebGPUEngine } from '@babylonjs/core';
import type { WebGPUCapabilities } from '../types';

export class WebGPURenderer {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private babylonWebGPUEngine: WebGPUEngine | null = null;
  private canvas: HTMLCanvasElement | null = null;

  public async initialize(canvas?: HTMLCanvasElement): Promise<void> {
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU not supported');
    }

    // Request adapter with performance preference
    this.adapter =
      (await navigator.gpu?.requestAdapter({
        powerPreference: 'high-performance',
        forceFallbackAdapter: false,
      })) || null;

    if (!this.adapter) {
      throw new Error('No suitable GPU adapter found');
    }

    // Request device with required features and limits
    const requiredFeatures: GPUFeatureName[] = [];
    if (this.adapter.features.has('texture-compression-bc')) {
      requiredFeatures.push('texture-compression-bc');
    }
    if (this.adapter.features.has('depth-clip-control')) {
      requiredFeatures.push('depth-clip-control');
    }

    this.device = await this.adapter.requestDevice({
      requiredFeatures,
      requiredLimits: {
        maxTextureDimension2D: Math.min(this.adapter.limits.maxTextureDimension2D, 8192),
        maxBufferSize: Math.min(this.adapter.limits.maxBufferSize, 256 * 1024 * 1024), // 256MB max
        maxBindGroups: Math.min(this.adapter.limits.maxBindGroups, 8),
      },
    });

    // Set up error handling
    this.device.addEventListener('uncapturederror', (event) => {
      console.error('[WebGPU] Uncaptured error:', (event as GPUUncapturedErrorEvent).error);
    });

    this.device.lost.then((reason) => {
      console.warn('[WebGPU] Device lost:', reason);
    });

    // Initialize Babylon.js WebGPU engine if canvas is provided
    if (canvas) {
      this.canvas = canvas;
      await this.initializeBabylonWebGPU();
    }

    console.log('[ENGINE] WebGPU renderer initialized successfully');
    console.log('[ENGINE] WebGPU adapter info:', {
      vendor: this.adapter.info?.vendor || 'unknown',
      architecture: this.adapter.info?.architecture || 'unknown',
      device: this.adapter.info?.device || 'unknown',
      description: this.adapter.info?.description || 'unknown',
    });
  }

  private async initializeBabylonWebGPU(): Promise<void> {
    if (!this.canvas || !this.device) {
      throw new Error('Canvas and device must be available to initialize Babylon.js WebGPU');
    }

    // Create Babylon.js WebGPU engine
    this.babylonWebGPUEngine = new WebGPUEngine(this.canvas, {
      deviceDescriptor: {
        requiredFeatures: Array.from(this.device.features) as GPUFeatureName[],
        requiredLimits: this.device.limits,
      },
      enableAllFeatures: true,
      antialias: true,
      stencil: true,
      powerPreference: 'high-performance',
    });

    // Initialize the WebGPU engine
    await this.babylonWebGPUEngine.initAsync();

    console.log('[ENGINE] Babylon.js WebGPU engine initialized');
  }

  public getBabylonEngine(): WebGPUEngine | null {
    return this.babylonWebGPUEngine;
  }

  public getGPUDevice(): GPUDevice | null {
    return this.device;
  }

  public getGPUAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  public getCapabilities(): WebGPUCapabilities {
    return {
      supported: this.adapter !== null && this.device !== null,
      limits: this.adapter?.limits || null,
      features: this.adapter?.features || null,
    };
  }

  public getDetailedCapabilities() {
    if (!this.adapter || !this.device) {
      return null;
    }

    return {
      adapter: {
        vendor: this.adapter.info?.vendor || 'unknown',
        architecture: this.adapter.info?.architecture || 'unknown',
        device: this.adapter.info?.device || 'unknown',
        description: this.adapter.info?.description || 'unknown',
        limits: this.adapter.limits,
        features: Array.from(this.adapter.features),
      },
      device: {
        limits: this.device.limits,
        features: Array.from(this.device.features),
        queue: {
          label: this.device.queue.label,
        },
      },
      babylonEngine: {
        initialized: this.babylonWebGPUEngine !== null,
        isReady: this.babylonWebGPUEngine !== null,
      },
    };
  }

  public dispose(): void {
    if (this.babylonWebGPUEngine) {
      this.babylonWebGPUEngine.dispose();
      this.babylonWebGPUEngine = null;
    }

    if (this.device) {
      this.device.destroy();
      this.device = null;
    }

    this.adapter = null;
    this.canvas = null;
  }
}
