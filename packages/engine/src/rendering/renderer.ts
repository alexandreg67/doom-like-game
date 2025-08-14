import type { Engine } from '@babylonjs/core';
import { WebGLRenderer } from './webgl-renderer';
import { WebGPURenderer } from './webgpu-renderer';

export class Renderer {
  private activeRenderer: WebGPURenderer | WebGLRenderer;
  private engine: Engine;

  constructor(engine: Engine, preferWebGPU = true) {
    this.engine = engine;

    if (preferWebGPU && this.isWebGPUSupported()) {
      this.activeRenderer = new WebGPURenderer();
    } else {
      this.activeRenderer = new WebGLRenderer(this.engine);
    }
  }

  public async initialize(): Promise<void> {
    await this.activeRenderer.initialize();
  }

  public getCapabilities() {
    return this.activeRenderer.getCapabilities();
  }

  public getRendererType(): 'webgpu' | 'webgl' {
    return this.activeRenderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
  }

  private isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }

  public dispose(): void {
    this.activeRenderer.dispose();
  }
}
