import type { Texture } from '../types';

export class TextureAtlas {
  private textures: Map<string, Texture> = new Map();

  addTexture(texture: Texture): void {
    this.textures.set(texture.name, texture);
  }

  getTexture(name: string): Texture | undefined {
    return this.textures.get(name);
  }
}
