import { Engine } from '@babylonjs/core';
import type { WebGLCapabilities } from '../types';

export class WebGLRenderer {
  private engine: Engine;
  private gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public async initialize(): Promise<void> {
    try {
      const canvas = this.engine.getRenderingCanvas();
      if (!canvas) {
        throw new Error('No canvas available for WebGL rendering');
      }

      // Try WebGL2 first, fallback to WebGL1
      this.gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!this.gl) {
        throw new Error('WebGL not supported');
      }

      const version = this.gl instanceof WebGL2RenderingContext ? 2 : 1;
      console.log(`[ENGINE] WebGL ${version} renderer initialized successfully`);
    } catch (error) {
      console.error('[ENGINE] Failed to initialize WebGL:', error);
      throw error;
    }
  }

  public getCapabilities(): WebGLCapabilities {
    if (!this.gl) {
      throw new Error('WebGL not initialized');
    }

    const version = this.gl instanceof WebGL2RenderingContext ? 2 : 1;
    const extensions = this.gl.getSupportedExtensions() || [];
    
    return {
      version: version as 1 | 2,
      extensions,
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxCombinedTextureImageUnits: this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      maxVertexAttribs: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
    };
  }

  public dispose(): void {
    this.gl = null;
  }
}