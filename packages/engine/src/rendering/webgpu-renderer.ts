import type { WebGPUCapabilities } from '../types';

export class WebGPURenderer {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;

  public async initialize(): Promise<void> {
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU not supported');
    }

    this.adapter = (await navigator.gpu?.requestAdapter()) || null;
    if (!this.adapter) {
      throw new Error('No suitable GPU adapter found');
    }

    this.device = await this.adapter.requestDevice();

    // TODO: Initialize WebGPU engine integration
    // Note: Babylon.js WebGPU integration will be implemented in next phase

    console.log('[ENGINE] WebGPU renderer initialized successfully');
  }

  public getCapabilities(): WebGPUCapabilities {
    return {
      supported: this.adapter !== null && this.device !== null,
      limits: this.adapter?.limits || null,
      features: this.adapter?.features || null,
    };
  }

  public dispose(): void {
    this.device = null;
    this.adapter = null;
  }
}
