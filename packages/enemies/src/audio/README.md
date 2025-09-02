# Enemy Audio System - 3D Spatial Audio

This module implements a 3D spatialized audio system for enemies, integrated with the existing FSM (Finite State Machine) system.

## Architecture

### Main Components

- **EnemyAudioComponent**: ECS component for an enemy's spatial audio
- **EnemyAudioSystem**: System that manages 3D audio and listens to FSM events
- **EnemyAudioManager**: Audio asset manager with fallbacks and placeholders

### FSM Integration

The audio system listens to FSM state transitions via events:

```typescript
// Added audio events
enum EnemyEventType {
  AUDIO_STATE_CHANGED = 'audio_state_changed',
  AUDIO_TRIGGERED = 'audio_triggered',
}

// Audio configuration per FSM state
interface AudioStateConfig {
  samples: string[];      // Audio files for this state
  volume: number;         // Volume (0-1)
  pitch: number;          // Base pitch
  pitchVariation: number; // Random pitch variation
  maxDistance: number;    // Maximum audible distance
  rolloffFactor: number;  // Attenuation factor
  loop: boolean;          // Looped audio
  triggerChance: number;  // Trigger probability (0-1)
  cooldown: number;       // Minimum time between triggers
}
```

## Usage

### Initialization

```typescript
import { EnemyAudioSystem, EnemyAudioManager, createAudioComponent } from '@doom-like/enemies';

// Create asset manager
const audioManager = new EnemyAudioManager(scene, {
  debug: true,
  basePath: './assets/audio/enemies/',
});

// Create audio system
const audioSystem = new EnemyAudioSystem(scene, {
  debug: true,
  masterVolume: 0.8,
});

// Connect with AI system for events
enemyAISystem.setEventCallback((event) => {
  audioSystem.queueEvent(event);
});

// Preload audio assets
await audioManager.preloadAllEnemyAudio();
```

### Adding Component to Entity

```typescript
import { createAudioComponent, EnemyType } from '@doom-like/enemies';

// Create audio component
const audioComponent = createAudioComponent(EnemyType.IMP, scene);

// Add to entity
entity.components.set('enemyAudio', audioComponent);
```

### System Update

```typescript
// In game loop
audioSystem.updateListenerPosition(playerPosition);
audioSystem.update(entities, deltaTime);
```

## Audio Configuration by Enemy Type

### Enemy Types and Audio Characteristics

```typescript
// IMP standard (baseline)
EnemyType.IMP: {
  volume: 1.0,        // Reference volume
  pitch: 1.0,         // Reference pitch
  maxDistance: 50,    // Reference distance
}

// Weak IMP (more discreet)
EnemyType.WEAK_IMP: {
  volume: 0.7,        // 30% quieter
  pitch: 1.1,         // Higher voice
  maxDistance: 40,    // Reduced range
}

// Tough IMP (more imposing)
EnemyType.TOUGH_IMP: {
  volume: 1.3,        // 30% louder
  pitch: 0.9,         // Lower voice
  maxDistance: 60,    // Increased range
}

// Alpha IMP (boss-like)
EnemyType.ALPHA_IMP: {
  volume: 1.5,        // 50% louder
  pitch: 0.8,         // Very low voice
  maxDistance: 75,    // Very long range
  rolloffFactor: 0.7, // Reduced attenuation
}
```

### FSM States and Associated Audio

| FSM State | Audio Type | Characteristics |
|-----------|------------|-----------------|
| `IDLE` | Breathing, ambiance | Low volume, loop, long cooldown |
| `SEEKING` | Footsteps, searching | Medium volume, no loop, medium cooldown |
| `CHASE` | Aggressive growls | High volume, no loop, short cooldown |
| `ATTACK` | Attack cries | Maximum volume, guaranteed trigger |
| `HURT` | Pain cries | High volume, elevated pitch, guaranteed trigger |
| `DEATH` | Final cry, fall | Maximum volume, long range, no cooldown |

## Audio Assets

### File Structure

```
assets/audio/enemies/
├── manifest.json              # Name → file mapping
├── imp_idle_breathing_01.ogg  # Idle state sounds
├── imp_idle_ambient_01.ogg
├── imp_seeking_footstep_01.ogg # Seeking sounds
├── imp_chase_roar_01.ogg      # Chase sounds
├── imp_attack_grunt_01.ogg    # Attack sounds
├── imp_hurt_scream_01.ogg     # Hurt sounds
├── imp_death_scream_01.ogg    # Death sounds
└── ...
```

### Supported Formats

1. **OGG Vorbis** (recommended) - Better compression, Web support
2. **MP3** - Universal compatibility
3. **WAV** - Maximum quality, but heavier

### Naming Convention

```
{enemyType}_{state}_{variation}_{index}.{format}

Examples:
- imp_idle_breathing_01.ogg
- tough_imp_attack_roar_02.mp3
- alpha_imp_death_final_01.wav
```

## Performance Optimizations

### System Level of Detail (LOD)

```typescript
// Distance-based LOD
const LOD_CONFIG = {
  close: 0-30,     // Full audio, advanced effects
  medium: 30-80,   // Standard audio, reduced effects
  far: 80-120,     // Basic audio only
  silent: 120+,    // No audio
};
```

### Audio Object Pooling

- **Pool size**: 10 sounds maximum per enemy type
- **Reuse**: Sounds recycled after playback
- **Cleanup**: Automatic cleanup every 5 seconds
- **Memory limit**: 50MB audio cache maximum

### Performance Metrics

```typescript
const stats = audioSystem.getStats();
console.log(`
Active audio sources: ${stats.activeAudioSources}
Avg update time: ${stats.avgAudioUpdateTime}ms
Memory usage: ${stats.audioPoolMemoryUsage / 1024 / 1024}MB
`);
```

## Fallbacks and Placeholders

### Procedural Generation

In the absence of real audio files, the system automatically generates placeholder sounds:

```typescript
// Generated sounds by type
'roar' → Low growl with noise
'grunt' → Short percussive sound
'footstep' → Rhythmic dull noise
'breathing' → Soft ambient sound
'scream' → High-pitched cry with decay
```

### Default Durations

- **Breathing/Ambiance**: 4-5 seconds
- **Footsteps/Short actions**: 0.3 seconds
- **Growls/Pain**: 1-2 seconds
- **Cries/Death**: 2-3 seconds

## Debug and Monitoring

### Debug Mode

```typescript
const audioSystem = new EnemyAudioSystem(scene, { debug: true });
const audioManager = new EnemyAudioManager(scene, { debug: true });

// Console logs:
// [ENEMY_AUDIO] Triggered imp_attack_01 for state ATTACK at intensity 1.0
// [ENEMY_AUDIO_MANAGER] Loaded 15 sounds for imp
```

### Real-time Metrics

```typescript
// System statistics
const systemStats = audioSystem.getStats();

// Cache statistics
const cacheStats = audioManager.getCacheStats();

// Component statistics
const componentStats = getAudioComponentStats(audioComponent);
```

## Tests

### Unit Tests

```bash
# Audio component tests
pnpm test enemy-audio-component.test.ts

# Audio system tests
pnpm test enemy-audio-system.test.ts

# Asset manager tests
pnpm test enemy-audio-manager.test.ts
```

### Integration Tests

```bash
# FSM → Audio integration test
pnpm test integration/fsm-audio.test.ts

# Performance test (50+ enemies)
pnpm test performance/audio-system.test.ts
```

## Troubleshooting

### Common Issues

1. **Audio not triggering**
   - Check that `audioComponent.isEnabled = true`
   - Check distance with `audioComponent.distanceToListener`
   - Control cooldown with `audioComponent.lastTriggerTime`

2. **Performance degraded**
   - Reduce number of active enemies
   - Increase audio culling distance
   - Check metrics with `getStats()`

3. **Missing/placeholder sounds**
   - Check asset structure in `/assets/audio/enemies/`
   - Control `manifest.json`
   - Enable debug to see loading attempts

### Recommended Configuration

```typescript
// Optimized production configuration
const PRODUCTION_CONFIG = {
  maxActiveEnemies: 20,      // Limit of enemies with audio
  audioLODDistance: 100,     // Audio LOD distance
  masterVolume: 0.7,         // Master volume
  spatialAudioEnabled: true, // 3D audio enabled
  debug: false,              // Debug disabled
};
```

## Future Extensions

- VR/AR support with binaural audio
- Audio occlusion (obstacles block sound)
- Dynamic reverb based on environment
- Adaptive audio based on difficulty
- Intelligent audio mixing (automatic ducking)