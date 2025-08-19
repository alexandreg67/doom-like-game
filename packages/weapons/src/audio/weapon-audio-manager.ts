/**
 * Weapon Audio Manager - handles 3D spatial audio for weapon sounds
 */

import type { Vector3 } from '@babylonjs/core';
import type { WeaponAudioConfig } from '../types';
import type { WeaponType } from '../weapons/weapon-factory';

export interface CustomAudioBuffer {
  buffer: ArrayBuffer;
  duration: number;
}

export interface SpatialAudioContext {
  position?: Vector3;
  orientation?: Vector3;
  velocity?: Vector3;
  volume?: number;
  pitch?: number;
}

export class WeaponAudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private rawBuffers: Map<string, ArrayBuffer> = new Map();
  private missingSounds: Set<string> = new Set();
  private manifest: Record<string, string> | null = null;
  private debug = false;

  // Audio settings
  private masterVolume = 1.0;
  private weaponVolumeMultiplier = 1.0;
  private spatialAudioEnabled = true;

  // No explicit constructor to satisfy linter; lazy init happens on demand

  /**
   * Initialize Web Audio API context (lazy initialization)
   */
  private async initializeAudioContext(): Promise<void> {
    if (this.audioContext) {
      if (this.debug) console.log('[WEAPON_AUDIO] Audio context already initialized');
      return;
    }

    try {
      if (this.debug) console.log('[WEAPON_AUDIO] Creating new AudioContext...');
      // Support prefixed implementations without using `any`
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) {
        throw new Error('Web Audio API not supported');
      }
      this.audioContext = new Ctx();
      if (this.debug)
        console.log(`[WEAPON_AUDIO] AudioContext created, state: ${this.audioContext.state}`);

      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = this.masterVolume;
      if (this.debug) console.log('[WEAPON_AUDIO] Master gain node created and connected');

      // Resume context if suspended (browser policy)
      if (this.audioContext.state === 'suspended') {
        // Do not auto-resume here to avoid autoplay violations; caller should resume on gesture
        if (this.debug)
          console.log('[WEAPON_AUDIO] AudioContext suspended (awaiting user gesture to resume)');
      }

      if (this.debug) console.log('[WEAPON_AUDIO] Audio context initialized successfully');
    } catch (error) {
      console.error('[WEAPON_AUDIO] Failed to initialize audio context:', error);
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  /** Enable/disable verbose logging */
  setDebugEnabled(enabled: boolean): void {
    this.debug = enabled;
  }

  /** Call this from a user gesture to ensure audio can play */
  async resumeOnUserGesture(): Promise<void> {
    await this.initializeAudioContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        if (this.debug) console.log('[WEAPON_AUDIO] Audio context resumed after user gesture');
      } catch (e) {
        console.warn('[WEAPON_AUDIO] Failed to resume audio context after user gesture', e);
      }
    }
  }

  /**
   * Load weapon audio assets
   */
  async loadWeaponSounds(weaponType: WeaponType): Promise<void> {
    // Load manifest lazily; do not initialize AudioContext here
    await this.ensureManifest();
    const sounds = this.getWeaponSoundList(weaponType);
    const loadPromises = sounds.map((soundId) => this.loadSound(soundId));

    await Promise.all(loadPromises);
  }

  /**
   * Load individual sound file
   */
  private async loadSound(soundId: string): Promise<void> {
    if (this.debug) console.log(`[WEAPON_AUDIO] Loading sound: ${soundId}`);

    if (this.audioBuffers.has(soundId) || this.rawBuffers.has(soundId)) {
      if (this.debug) console.log(`[WEAPON_AUDIO] Sound already loaded: ${soundId}`);
      return; // Already loaded
    }

    try {
      // Fetch the binary without requiring an AudioContext
      const arrayBuffer = await this.fetchAudioBinary(soundId);
      if (arrayBuffer) {
        this.rawBuffers.set(soundId, arrayBuffer);
        if (this.audioContext) {
          // If context exists, decode immediately
          const decoded = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
          this.audioBuffers.set(soundId, decoded);
        }
        if (this.debug) console.log(`[WEAPON_AUDIO] Loaded binary for: ${soundId}`);
      } else {
        // Mark missing; placeholder will be created at playback time if needed
        this.missingSounds.add(soundId);
        if (this.debug)
          console.log(
            `[WEAPON_AUDIO] No file available for: ${soundId} (will use placeholder at play)`
          );
      }
    } catch (error) {
      console.warn(`[WEAPON_AUDIO] Failed to load sound: ${soundId}`, error);
    }
  }

  /**
   * Fetch audio binary using manifest when available to avoid 404 spam
   */
  private async fetchAudioBinary(soundId: string): Promise<ArrayBuffer | null> {
    const tryUrl = async (url: string): Promise<ArrayBuffer | null> => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.arrayBuffer();
        }
      } catch {
        // swallow fetch errors; we'll fall back
      }
      return null;
    };

    // Prefer manifest mapping to avoid trial-and-error
    const mapped = this.manifest?.[soundId];
    if (mapped) {
      const fromManifest = await tryUrl(`/audio/weapons/${mapped}`);
      if (fromManifest) return fromManifest;
    }

    // Fallback: minimal trial order biased by repo assets
    const extensions = ['mp3', 'wav', 'ogg'];
    for (const ext of extensions) {
      const binary = await tryUrl(`/audio/weapons/${soundId}.${ext}`);
      if (binary) return binary;
    }
    return null;
  }

  /** Load manifest once, if available */
  private async ensureManifest(): Promise<void> {
    if (this.manifest !== null) return;
    try {
      const res = await fetch('/audio/weapons/manifest.json');
      if (res.ok) {
        this.manifest = await res.json();
        if (this.debug) console.log('[WEAPON_AUDIO] Loaded audio manifest');
      } else {
        this.manifest = {};
      }
    } catch {
      this.manifest = {};
    }
  }

  /**
   * Create placeholder audio buffer for testing/development
   */
  private createPlaceholderBuffer(soundId: string): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }

    // Create a simple synthetic sound based on the sound type
    const duration = this.getSoundDuration(soundId);
    const sampleRate = this.audioContext.sampleRate;
    const length = Math.floor(duration * sampleRate);

    // Create a real AudioBuffer
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const channelData = buffer.getChannelData(0);

    // Generate different sounds based on soundId
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      if (soundId.includes('fire')) {
        // Sharp attack, quick decay (gun shot)
        const envelope = Math.exp(-t * 10);
        sample = (Math.random() - 0.5) * envelope * 0.3;
      } else if (soundId.includes('reload')) {
        // Mechanical clicking sound
        const freq = 220 + Math.sin(t * 4) * 110;
        sample = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 2) * 0.1;
      } else {
        // Default beep
        sample = Math.sin(t * 440 * Math.PI * 2) * Math.exp(-t * 5) * 0.1;
      }

      channelData[i] = sample;
    }

    if (this.debug)
      console.log(`[WEAPON_AUDIO] Created placeholder sound: ${soundId} (${duration}s)`);
    return buffer;
  }

  /**
   * Get expected duration for different sound types
   */
  private getSoundDuration(soundId: string): number {
    if (soundId.includes('fire')) return 0.2;
    if (soundId.includes('reload')) return 2.0;
    if (soundId.includes('empty')) return 0.1;
    if (soundId.includes('switch')) return 0.3;
    return 0.5;
  }

  /**
   * Get list of sounds needed for a weapon type
   */
  private getWeaponSoundList(weaponType: WeaponType): string[] {
    const baseSounds = [
      `${weaponType}_fire`,
      `${weaponType}_reload`,
      'weapon_empty',
      'weapon_switch',
    ];

    // Add specific sounds for certain weapons
    if (weaponType === 'rocket_launcher') {
      baseSounds.push('rocket_explosion', 'rocket_travel');
    }

    if (weaponType === 'shotgun') {
      baseSounds.push('shotgun_pump');
    }

    return baseSounds;
  }

  /**
   * Play weapon sound with spatial audio
   */
  async playWeaponSound(
    soundId: string,
    config: WeaponAudioConfig,
    spatialContext?: SpatialAudioContext
  ): Promise<void> {
    if (this.debug) console.log(`[WEAPON_AUDIO] PlayWeaponSound called with: ${soundId}`);

    // Initialize audio context on first use (user interaction)
    if (!this.audioContext) {
      if (this.debug) console.log('[WEAPON_AUDIO] Initializing audio context on first play...');
      await this.initializeAudioContext();
    }

    // Resume suspended audio context
    if (this.audioContext && this.audioContext.state === 'suspended') {
      if (this.debug) console.log('[WEAPON_AUDIO] Resuming suspended audio context...');
      try {
        await this.audioContext.resume();
        if (this.debug) console.log('[WEAPON_AUDIO] Audio context resumed successfully');
      } catch (error) {
        console.error('[WEAPON_AUDIO] Failed to resume audio context:', error);
      }
    }

    if (!this.audioContext || !this.masterGain) {
      console.warn('[WEAPON_AUDIO] Audio context not available after initialization');
      return;
    }

    let audioBuffer = this.audioBuffers.get(soundId);
    if (!audioBuffer) {
      // Try to decode from preloaded binary
      const raw = this.rawBuffers.get(soundId);
      if (raw && this.audioContext) {
        try {
          const decoded = await this.audioContext.decodeAudioData(raw.slice(0));
          this.audioBuffers.set(soundId, decoded);
          audioBuffer = decoded;
        } catch (e) {
          console.warn(`[WEAPON_AUDIO] Failed to decode raw buffer for: ${soundId}`, e);
        }
      }
      // If still not available, attempt fetch now
      if (!audioBuffer) {
        await this.loadSound(soundId);
        audioBuffer = this.audioBuffers.get(soundId);
      }
      // As last resort, synthesize placeholder
      if (!audioBuffer && this.audioContext) {
        audioBuffer = this.createPlaceholderBuffer(soundId);
        this.audioBuffers.set(soundId, audioBuffer);
      }
    }

    try {
      if (!audioBuffer) {
        console.warn(`[WEAPON_AUDIO] No audio buffer available for: ${soundId}`);
        return;
      }
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      // Configure basic audio properties
      this.configureAudioSource(source, audioBuffer, config);
      this.configureGain(gainNode, config, spatialContext);

      // Set up audio graph
      let audioChain: AudioNode = source;

      // Add spatial audio if enabled and context provided
      if (this.spatialAudioEnabled && spatialContext?.position && config.spatialAudio) {
        const pannerNode = this.createSpatialAudio(spatialContext);
        source.connect(pannerNode);
        pannerNode.connect(gainNode);
        audioChain = gainNode;
      } else {
        source.connect(gainNode);
        audioChain = gainNode;
      }

      // Connect to master gain and play
      audioChain.connect(this.masterGain);

      // Track active source
      this.activeSources.add(source);

      // Clean up when done
      source.addEventListener('ended', () => {
        this.activeSources.delete(source);
        source.disconnect();
        gainNode.disconnect();
      });

      // Start playback
      source.start();
    } catch (error) {
      console.warn(`[WEAPON_AUDIO] Failed to play sound: ${soundId}`, error);
    }
  }

  /**
   * Configure audio source properties
   */
  private configureAudioSource(
    source: AudioBufferSourceNode,
    audioBuffer: AudioBuffer,
    config: WeaponAudioConfig
  ): void {
    // Attach the decoded/placeholder buffer so the source actually plays
    source.buffer = audioBuffer;
    source.loop = false;

    // Set playback rate for pitch adjustment
    source.playbackRate.value = config.pitch || 1.0;

    // Add slight random variation to prevent identical sounds
    const variation = 0.05; // 5% variation
    const randomPitch = 1.0 + (Math.random() - 0.5) * variation;
    source.playbackRate.value *= randomPitch;
  }

  /**
   * Configure gain node for volume control
   */
  private configureGain(
    gainNode: GainNode,
    config: WeaponAudioConfig,
    spatialContext?: SpatialAudioContext
  ): void {
    let volume = config.volume || 1.0;
    volume *= this.weaponVolumeMultiplier;

    // Apply spatial context volume modifier
    if (spatialContext?.volume !== undefined) {
      volume *= spatialContext.volume;
    }

    gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  /**
   * Create spatial audio panner node
   */
  private createSpatialAudio(spatialContext: SpatialAudioContext): PannerNode {
    if (!this.audioContext) {
      throw new Error('Audio context not available');
    }

    const panner = this.audioContext.createPanner();

    // Configure 3D audio properties
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 1000;
    panner.rolloffFactor = 1;
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 0;
    panner.coneOuterGain = 0;

    // Set position
    if (spatialContext.position) {
      panner.positionX.value = spatialContext.position.x;
      panner.positionY.value = spatialContext.position.y;
      panner.positionZ.value = spatialContext.position.z;
    }

    // Set orientation
    if (spatialContext.orientation) {
      panner.orientationX.value = spatialContext.orientation.x;
      panner.orientationY.value = spatialContext.orientation.y;
      panner.orientationZ.value = spatialContext.orientation.z;
    }

    return panner;
  }

  /**
   * Update listener position (camera/player position)
   */
  updateListenerPosition(position: Vector3, orientation?: Vector3, up?: Vector3): void {
    if (!this.audioContext || !this.audioContext.listener) {
      return;
    }

    const listener = this.audioContext.listener;

    // Update position
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
    }

    // Update orientation
    if (orientation && listener.forwardX) {
      listener.forwardX.value = orientation.x;
      listener.forwardY.value = orientation.y;
      listener.forwardZ.value = orientation.z;
    }

    // Update up vector
    if (up && listener.upX) {
      listener.upX.value = up.x;
      listener.upY.value = up.y;
      listener.upZ.value = up.z;
    }
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /**
   * Set weapon-specific volume multiplier
   */
  setWeaponVolume(volume: number): void {
    this.weaponVolumeMultiplier = Math.max(0, Math.min(1, volume));
  }

  /**
   * Enable/disable spatial audio
   */
  setSpatialAudioEnabled(enabled: boolean): void {
    this.spatialAudioEnabled = enabled;
  }

  /**
   * Stop all currently playing weapon sounds
   */
  stopAllSounds(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Source may already be stopped
      }
    }
    this.activeSources.clear();
  }

  /**
   * Preload all weapon audio assets
   */
  async preloadAllWeaponSounds(): Promise<void> {
    console.log('[WEAPON_AUDIO] Starting preload of all weapon sounds');
    const weaponTypes: WeaponType[] = [
      'pistol',
      'enhanced_pistol',
      'shotgun',
      'chaingun',
      'rocket_launcher',
    ];

    // Load sounds using weapon factory to get actual audio configurations
    const { WeaponFactory } = await import('../weapons/weapon-factory');
    const allSounds = new Set<string>();

    // Get actual sound names from weapon configurations
    for (const type of weaponTypes) {
      try {
        const weapon = WeaponFactory.createWeapon(type);
        const audioConfig = weapon.getAudioConfig();

        allSounds.add(audioConfig.fireSound);
        allSounds.add(audioConfig.reloadSound);
        allSounds.add(audioConfig.emptySound);
        allSounds.add(audioConfig.switchSound);

        console.log(`[WEAPON_AUDIO] Preloading sounds for ${type}:`, audioConfig);
      } catch (error) {
        console.warn(`[WEAPON_AUDIO] Failed to get sounds for ${type}:`, error);
        // Fallback to generic names
        const fallbackSounds = this.getWeaponSoundList(type);
        for (const sound of fallbackSounds) {
          allSounds.add(sound);
        }
      }
    }

    console.log(`[WEAPON_AUDIO] Loading ${allSounds.size} unique sounds:`, Array.from(allSounds));
    const loadPromises = Array.from(allSounds).map((soundId) => this.loadSound(soundId));
    await Promise.all(loadPromises);
    console.log('[WEAPON_AUDIO] All weapon sounds preloaded successfully');
  }

  /**
   * Get audio context state
   */
  getAudioState(): {
    initialized: boolean;
    suspended: boolean;
    activeSounds: number;
    loadedSounds: number;
  } {
    return {
      initialized: !!this.audioContext,
      suspended: this.audioContext?.state === 'suspended',
      activeSounds: this.activeSources.size,
      loadedSounds: this.audioBuffers.size,
    };
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAllSounds();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffers.clear();
    this.masterGain = null;
  }
}
