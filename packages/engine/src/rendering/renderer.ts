import { Engine } from '@babylonjs/core';
import { WebGPURenderer } from './webgpu-renderer';
import { WebGLRenderer } from './webgl-renderer';

export class Renderer {
  private activeRenderer: WebGPURenderer | WebGLRenderer;
  private engine: Engine;

  constructor(engine: Engine, preferWebGPU: boolean = true) {
    this.engine = engine;
    
    if (preferWebGPU && this.isWebGPUSupported()) {
      this.activeRenderer = new WebGPURenderer(engine);
    } else {
      this.activeRenderer = new WebGLRenderer(engine);
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