import type { Engine } from '@babylonjs/core';
import { WebGLRenderer } from './webgl-renderer';
import { WebGPURenderer } from './webgpu-renderer';

export class Renderer {
  private activeRenderer: WebGPURenderer | WebGLRenderer;
  private engine: Engine;
  private canvas: HTMLCanvasElement;

  constructor(engine: Engine, preferWebGPU = true) {
    this.engine = engine;
    const canvas = engine.getRenderingCanvas();
    if (!canvas) {
      throw new Error('Rendering canvas is not available from engine');
    }
    this.canvas = canvas;

    if (preferWebGPU && this.isWebGPUSupported()) {
      this.activeRenderer = new WebGPURenderer();
    } else {
      this.activeRenderer = new WebGLRenderer(this.engine);
    }
  }

  public async initialize(): Promise<void> {
    try {
      if (this.activeRenderer instanceof WebGPURenderer) {
        await this.activeRenderer.initialize(this.canvas);
      } else {
        await this.activeRenderer.initialize();
      }
    } catch (error) {
      // If WebGPU fails, fallback to WebGL
      if (this.activeRenderer instanceof WebGPURenderer) {
        console.log('[ENGINE] WebGPU not available, using WebGL2 renderer');
        console.log('[ENGINE] WebGPU error:', error);
        this.activeRenderer = new WebGLRenderer(this.engine);
        await this.activeRenderer.initialize();
      } else {
        throw error;
      }
    }
  }

  public getCapabilities() {
    return this.activeRenderer.getCapabilities();
  }

  public getDetailedCapabilities() {
    if (this.activeRenderer instanceof WebGPURenderer) {
      return this.activeRenderer.getDetailedCapabilities();
    }
    return this.activeRenderer.getCapabilities();
  }

  public getRendererType(): 'webgpu' | 'webgl' {
    return this.activeRenderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
  }

  public getBabylonEngine() {
    if (this.activeRenderer instanceof WebGPURenderer) {
      return this.activeRenderer.getBabylonEngine();
    }
    return this.engine;
  }

  public getActiveRenderer(): WebGPURenderer | WebGLRenderer {
    return this.activeRenderer;
  }

  private isWebGPUSupported(): boolean {
    return 'gpu' in navigator;
  }

  public dispose(): void {
    this.activeRenderer.dispose();
  }
}
