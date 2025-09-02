import { type Scene, Texture } from '@babylonjs/core';
// Logger will be imported from the engine package when available
// For now, we'll use console logging
import type {
  AnimationState,
  SpriteDirection,
  SpriteSheet,
} from '../components/enemy-render-component';
import { EnemyState, type EnemyType } from '../types';

/**
 * Sprite configuration for different enemy types and states
 */
interface SpriteConfig {
  /** Base path for sprite assets */
  basePath: string;
  /** Available animation sequences */
  sequences: Record<string, SpriteSequenceConfig>;
  /** Default scale multiplier */
  defaultScale: number;
  /** Whether this enemy type uses 8-direction sprites */
  hasDirections: boolean;
}

/**
 * Configuration for a sprite animation sequence
 */
interface SpriteSequenceConfig {
  /** Sequence name (idle, walk, attack, etc.) */
  name: string;
  /** Number of animation frames */
  frameCount: number;
  /** Animation speed in FPS */
  fps: number;
  /** Whether animation should loop */
  loop: boolean;
  /** File naming pattern */
  pattern: string; // e.g., "imp_walk_{direction}_{frame}.png"
}

/**
 * Cached sprite data for performance
 */
interface SpriteCache {
  /** Loaded textures by key */
  textures: Map<string, Texture>;
  /** Sprite sheets by enemy type */
  spriteSheets: Map<EnemyType, SpriteSheet>;
  /** Cache timestamps for cleanup */
  lastAccessed: Map<string, number>;
}

/**
 * EnemySpriteManager - Manages sprite assets and animations for enemies
 * Handles DOOM-style 8-direction billboard sprites with animation sequences
 */
export class EnemySpriteManager {
  private scene: Scene;
  private cache: SpriteCache;
  private spriteConfigs: Map<EnemyType, SpriteConfig>;
  private stateToSequenceMappings: Map<EnemyType, Partial<Record<EnemyState, string>>>;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(scene: Scene) {
    this.scene = scene;
    this.cache = {
      textures: new Map(),
      spriteSheets: new Map(),
      lastAccessed: new Map(),
    };
    this.spriteConfigs = new Map();
    this.stateToSequenceMappings = new Map();

    // Initialize default sprite configurations
    this.initializeDefaultConfigs();

    console.log('[SPRITE_MANAGER] EnemySpriteManager initialized');
  }

  /**
   * Initialize default sprite configurations for built-in enemy types
   */
  private initializeDefaultConfigs(): void {
    // Imp sprite configuration
    this.spriteConfigs.set('imp' as EnemyType, {
      basePath: '/sprites/enemies/imp/',
      defaultScale: 1.0,
      hasDirections: true,
      sequences: {
        idle: {
          name: 'idle',
          frameCount: 1,
          fps: 1,
          loop: true,
          pattern: 'imp_idle_{direction}.png',
        },
        walk: {
          name: 'walk',
          frameCount: 4,
          fps: 8,
          loop: true,
          pattern: 'imp_walk_{direction}_{frame}.png',
        },
        run: {
          name: 'run',
          frameCount: 4,
          fps: 12,
          loop: true,
          pattern: 'imp_run_{direction}_{frame}.png',
        },
        attack: {
          name: 'attack',
          frameCount: 3,
          fps: 10,
          loop: false,
          pattern: 'imp_attack_{direction}_{frame}.png',
        },
        pain: {
          name: 'pain',
          frameCount: 2,
          fps: 8,
          loop: false,
          pattern: 'imp_pain_{direction}_{frame}.png',
        },
        death: {
          name: 'death',
          frameCount: 5,
          fps: 6,
          loop: false,
          pattern: 'imp_death_{frame}.png', // Death has no direction
        },
      },
    });

    console.log('[SPRITE_MANAGER] Default sprite configurations loaded');
  }

  /**
   * Loads sprite sheet for a specific enemy type
   */
  async loadSpriteSheet(enemyType: EnemyType): Promise<SpriteSheet> {
    // Check cache first
    const cached = this.cache.spriteSheets.get(enemyType);
    if (cached) {
      this.updateCacheTimestamp(`spritesheet_${enemyType}`);
      return cached;
    }

    const config = this.spriteConfigs.get(enemyType);
    if (!config) {
      throw new Error(`No sprite configuration found for enemy type: ${enemyType}`);
    }

    console.log(`[SPRITE_MANAGER] Loading sprite sheet for ${enemyType}...`);

    try {
      const spriteSheet = await this.buildSpriteSheet(enemyType, config);
      this.cache.spriteSheets.set(enemyType, spriteSheet);
      this.updateCacheTimestamp(`spritesheet_${enemyType}`);

      console.log(`[SPRITE_MANAGER] Successfully loaded sprite sheet for ${enemyType}`);
      return spriteSheet;
    } catch (error) {
      console.error(`[SPRITE_MANAGER] Failed to load sprite sheet for ${enemyType}:`, error);
      throw error;
    }
  }

  /**
   * Builds a sprite sheet from individual sprite files
   */
  private async buildSpriteSheet(enemyType: EnemyType, config: SpriteConfig): Promise<SpriteSheet> {
    const frames = new Map<string, Texture[]>();

    // Load all sprite frames for each sequence
    for (const [_sequenceName, sequenceConfig] of Object.entries(config.sequences)) {
      await this.loadSequenceFrames(config.basePath, sequenceConfig, config.hasDirections, frames);
    }

    // Create a placeholder texture for the main sprite sheet
    // In a real implementation, this would be a texture atlas
    const mainTexture = await this.loadTexture(
      `${config.basePath}imp_idle_0.png`,
      `${enemyType}_main_texture`
    );

    return {
      texture: mainTexture,
      frames,
      frameWidth: 64, // Standard DOOM sprite size
      frameHeight: 64,
      atlasWidth: 512, // Atlas dimensions
      atlasHeight: 512,
    };
  }

  /**
   * Loads all frames for a sprite sequence
   */
  private async loadSequenceFrames(
    basePath: string,
    sequence: SpriteSequenceConfig,
    hasDirections: boolean,
    framesMap: Map<string, Texture[]>
  ): Promise<void> {
    const directions = hasDirections ? 8 : 1;

    for (let dir = 0; dir < directions; dir++) {
      const frames: Texture[] = [];

      for (let frame = 0; frame < sequence.frameCount; frame++) {
        const filename = this.generateSpriteFilename(sequence.pattern, dir, frame);
        const texturePath = basePath + filename;

        try {
          const texture = await this.loadTexture(texturePath, `${sequence.name}_${dir}_${frame}`);
          frames.push(texture);
        } catch (_error) {
          console.warn(`[SPRITE_MANAGER] Failed to load frame ${filename}, using placeholder`);
          // Use first frame or create placeholder
          const placeholder = frames[0] || (await this.createPlaceholderTexture());
          frames.push(placeholder);
        }
      }

      const frameKey = hasDirections ? `${sequence.name}_${dir}` : sequence.name;
      framesMap.set(frameKey, frames);
    }
  }

  /**
   * Generates sprite filename from pattern
   */
  private generateSpriteFilename(pattern: string, direction: number, frame: number): string {
    return pattern
      .replace('{direction}', direction.toString())
      .replace('{frame}', frame.toString().padStart(2, '0'));
  }

  /**
   * Loads a single texture with caching
   */
  private async loadTexture(path: string, cacheKey: string): Promise<Texture> {
    // Check cache first
    const cached = this.cache.textures.get(cacheKey);
    if (cached) {
      this.updateCacheTimestamp(cacheKey);
      return cached;
    }

    try {
      const texture = new Texture(path, this.scene, {
        noMipmap: false,
        invertY: false,
        samplingMode: Texture.NEAREST_SAMPLINGMODE, // Pixel-perfect DOOM style
      });

      // Wait for texture to load with proper error handling
      await new Promise<void>((resolve, reject) => {
        let isResolved = false;

        texture.onLoadObservable.addOnce(() => {
          if (!isResolved) {
            isResolved = true;
            resolve();
          }
        });

        // Use onErrorObservable if available (Babylon.js 5.0+)
        if ('onErrorObservable' in texture && texture.onErrorObservable) {
          (texture.onErrorObservable as any).addOnce(() => {
            if (!isResolved) {
              isResolved = true;
              reject(new Error(`Texture failed to load: ${path}`));
            }
          });
        }

        // Fallback timeout for older Babylon.js versions or network issues
        setTimeout(() => {
          if (!isResolved && !texture.isReady()) {
            isResolved = true;
            reject(new Error(`Texture load timeout: ${path}`));
          }
        }, 10000); // Increased to 10s for slower networks
      });

      this.cache.textures.set(cacheKey, texture);
      this.updateCacheTimestamp(cacheKey);
      return texture;
    } catch (_error) {
      console.warn(`[SPRITE_MANAGER] Failed to load texture ${path}, creating placeholder`);
      return this.createPlaceholderTexture();
    }
  }

  /**
   * Creates a placeholder texture for missing sprites
   */
  private async createPlaceholderTexture(): Promise<Texture> {
    const cacheKey = 'placeholder_texture';

    // Check if already created
    const cached = this.cache.textures.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create a simple colored texture as placeholder
    const texture = Texture.CreateFromBase64String(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      'placeholder',
      this.scene,
      {
        noMipmap: true,
        invertY: false,
        samplingMode: Texture.NEAREST_SAMPLINGMODE,
      }
    );

    this.cache.textures.set(cacheKey, texture);
    return texture;
  }

  /**
   * Gets texture for specific enemy state and direction
   */
  getFrameTexture(
    spriteSheet: SpriteSheet,
    state: EnemyState,
    direction: SpriteDirection,
    frameIndex = 0,
    enemyType?: EnemyType
  ): Texture | null {
    const sequenceName = this.mapStateToSequence(state, enemyType);
    const frameKey = `${sequenceName}_${direction}`;

    const frames = spriteSheet.frames.get(frameKey);
    if (!frames || frames.length === 0) {
      console.warn(`[SPRITE_MANAGER] No frames found for ${frameKey}`);
      return null;
    }

    // Clamp frame index to available frames
    const safeFrameIndex = Math.min(frameIndex, frames.length - 1);
    return frames[safeFrameIndex] || null;
  }

  /**
   * Default state-to-sequence mapping configuration
   * Can be overridden per enemy type for customization
   */
  private static readonly STATE_TO_SEQUENCE_MAP: Record<EnemyState, string> = {
    [EnemyState.IDLE]: 'idle',
    [EnemyState.SEEKING]: 'walk',
    [EnemyState.CHASE]: 'run',
    [EnemyState.ATTACK]: 'attack',
    [EnemyState.HURT]: 'pain',
    [EnemyState.DEATH]: 'death',
  } as const;

  /**
   * Maps enemy FSM state to sprite sequence name
   * Uses configurable mapping for flexibility
   */
  private mapStateToSequence(state: EnemyState, enemyType?: EnemyType): string {
    // Check for enemy-type-specific mapping first
    if (enemyType) {
      const customMapping = this.stateToSequenceMappings.get(enemyType);
      const customSequence = customMapping?.[state];
      if (customSequence) {
        return customSequence;
      }
    }

    // Fall back to default mapping
    return EnemySpriteManager.STATE_TO_SEQUENCE_MAP[state] || 'idle';
  }

  /**
   * Configures custom state-to-sequence mapping for a specific enemy type
   * @param enemyType The enemy type to configure
   * @param mapping Partial mapping of states to sequence names (overrides defaults)
   */
  setStateToSequenceMapping(
    enemyType: EnemyType,
    mapping: Partial<Record<EnemyState, string>>
  ): void {
    this.stateToSequenceMappings.set(enemyType, mapping);
    console.log(`[SPRITE_MANAGER] Custom mapping configured for ${enemyType}:`, mapping);
  }

  /**
   * Gets animation configuration for a state
   */
  getAnimationConfig(enemyType: EnemyType, state: EnemyState): SpriteSequenceConfig | null {
    const config = this.spriteConfigs.get(enemyType);
    if (!config) return null;

    const sequenceName = this.mapStateToSequence(state, enemyType);
    return config.sequences[sequenceName] || null;
  }

  /**
   * Creates animation state for enemy
   */
  createAnimationState(enemyType: EnemyType, state: EnemyState): AnimationState {
    const config = this.getAnimationConfig(enemyType, state);

    return {
      currentFrame: 0,
      totalFrames: config?.frameCount || 1,
      animationSpeed: config?.fps || 8,
      frameTimer: 0,
      loop: config?.loop ?? true,
      isPlaying: true,
      sequenceName: this.mapStateToSequence(state, enemyType),
    };
  }

  /**
   * Updates cache timestamp for cleanup
   */
  private updateCacheTimestamp(key: string): void {
    this.cache.lastAccessed.set(key, performance.now());
  }

  /**
   * Cleans up expired cache entries
   */
  cleanupCache(): void {
    const now = performance.now();
    const expiredKeys: string[] = [];

    // Find expired entries
    for (const [key, timestamp] of this.cache.lastAccessed.entries()) {
      if (now - timestamp > this.cacheTimeout) {
        expiredKeys.push(key);
      }
    }

    // Remove expired textures
    for (const key of expiredKeys) {
      const texture = this.cache.textures.get(key);
      if (texture) {
        texture.dispose();
        this.cache.textures.delete(key);
      }
      this.cache.lastAccessed.delete(key);
    }

    if (expiredKeys.length > 0) {
      console.log(`[SPRITE_MANAGER] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): {
    textureCount: number;
    spriteSheetCount: number;
    totalMemoryEstimate: number;
  } {
    return {
      textureCount: this.cache.textures.size,
      spriteSheetCount: this.cache.spriteSheets.size,
      // Rough estimate: 64x64x4 bytes per texture
      totalMemoryEstimate: this.cache.textures.size * 64 * 64 * 4,
    };
  }

  /**
   * Registers a custom sprite configuration
   */
  registerSpriteConfig(enemyType: EnemyType, config: SpriteConfig): void {
    this.spriteConfigs.set(enemyType, config);
    console.log(`[SPRITE_MANAGER] Registered custom sprite config for ${enemyType}`);
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    console.log('[SPRITE_MANAGER] Disposing EnemySpriteManager...');

    // Dispose all cached textures
    for (const texture of this.cache.textures.values()) {
      texture.dispose();
    }

    // Clear all caches
    this.cache.textures.clear();
    this.cache.spriteSheets.clear();
    this.cache.lastAccessed.clear();
    this.spriteConfigs.clear();
    this.stateToSequenceMappings.clear();

    console.log('[SPRITE_MANAGER] EnemySpriteManager disposed');
  }
}
