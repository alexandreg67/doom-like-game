# Enemy Audio System - 3D Spatial Audio

Ce module implémente un système audio 3D spatialisé pour les ennemis, intégré au système FSM (Finite State Machine) existant.

## Architecture

### Composants principaux

- **EnemyAudioComponent** : Composant ECS pour l'audio spatial d'un ennemi
- **EnemyAudioSystem** : Système qui gère l'audio 3D et écoute les événements FSM
- **EnemyAudioManager** : Gestionnaire d'assets audio avec fallbacks et placeholders

### Intégration FSM

Le système audio écoute les transitions d'état FSM via des événements :

```typescript
// Événements audio ajoutés
enum EnemyEventType {
  AUDIO_STATE_CHANGED = 'audio_state_changed',
  AUDIO_TRIGGERED = 'audio_triggered',
}

// Configuration audio par état FSM
interface AudioStateConfig {
  samples: string[];      // Fichiers audio pour cet état
  volume: number;         // Volume (0-1)
  pitch: number;          // Pitch de base
  pitchVariation: number; // Variation aléatoire du pitch
  maxDistance: number;    // Distance maximale audible
  rolloffFactor: number;  // Facteur d'atténuation
  loop: boolean;          // Audio en boucle
  triggerChance: number;  // Probabilité de déclencher (0-1)
  cooldown: number;       // Temps minimum entre déclenchements
}
```

## Utilisation

### Initialisation

```typescript
import { EnemyAudioSystem, EnemyAudioManager, EnemyAudioUtils } from '@doom-like/enemies';

// Créer le gestionnaire d'assets
const audioManager = new EnemyAudioManager(scene, {
  debug: true,
  basePath: './assets/audio/enemies/',
});

// Créer le système audio
const audioSystem = new EnemyAudioSystem(scene, {
  debug: true,
  masterVolume: 0.8,
});

// Connecter avec le système AI pour les événements
enemyAISystem.setEventCallback((event) => {
  audioSystem.queueEvent(event);
});

// Précharger les assets audio
await audioManager.preloadAllEnemyAudio();
```

### Ajout du composant à une entité

```typescript
import { EnemyAudioUtils, EnemyType } from '@doom-like/enemies';

// Créer le composant audio
const audioComponent = EnemyAudioUtils.createComponent(EnemyType.IMP, scene);

// Ajouter à l'entité
entity.components.set('enemyAudio', audioComponent);
```

### Mise à jour du système

```typescript
// Dans la boucle de jeu
audioSystem.updateListenerPosition(playerPosition);
audioSystem.update(entities, deltaTime);
```

## Configuration audio par type d'ennemi

### Types d'ennemis et leurs caractéristiques audio

```typescript
// IMP standard (baseline)
EnemyType.IMP: {
  volume: 1.0,        // Volume de référence
  pitch: 1.0,         // Pitch de référence
  maxDistance: 50,    // Distance de référence
}

// IMP faible (plus discret)
EnemyType.WEAK_IMP: {
  volume: 0.7,        // 30% plus silencieux
  pitch: 1.1,         // Voix plus aiguë
  maxDistance: 40,    // Portée réduite
}

// IMP résistant (plus imposant)
EnemyType.TOUGH_IMP: {
  volume: 1.3,        // 30% plus fort
  pitch: 0.9,         // Voix plus grave
  maxDistance: 60,    // Portée augmentée
}

// IMP alpha (boss-like)
EnemyType.ALPHA_IMP: {
  volume: 1.5,        // 50% plus fort
  pitch: 0.8,         // Voix très grave
  maxDistance: 75,    // Très longue portée
  rolloffFactor: 0.7, // Atténuation réduite
}
```

### États FSM et audio associé

| État FSM | Type d'audio | Caractéristiques |
|----------|--------------|------------------|
| `IDLE` | Respiration, ambiance | Volume faible, loop, cooldown long |
| `SEEKING` | Pas, recherche | Volume moyen, pas de loop, cooldown moyen |
| `CHASE` | Grognements agressifs | Volume fort, pas de loop, cooldown court |
| `ATTACK` | Cris d'attaque | Volume maximum, déclenchement garanti |
| `HURT` | Cris de douleur | Volume fort, pitch élevé, déclenchement garanti |
| `DEATH` | Cri final, chute | Volume maximum, longue portée, pas de cooldown |

## Assets audio

### Structure des fichiers

```
assets/audio/enemies/
├── manifest.json              # Mapping nom → fichier
├── imp_idle_breathing_01.ogg  # Sons d'état inactif
├── imp_idle_ambient_01.ogg
├── imp_seeking_footstep_01.ogg # Sons de recherche
├── imp_chase_roar_01.ogg      # Sons de poursuite
├── imp_attack_grunt_01.ogg    # Sons d'attaque
├── imp_hurt_scream_01.ogg     # Sons de douleur
├── imp_death_scream_01.ogg    # Sons de mort
└── ...
```

### Formats supportés

1. **OGG Vorbis** (recommandé) - Meilleure compression, support Web
2. **MP3** - Compatibilité universelle
3. **WAV** - Qualité maximale, mais plus lourd

### Naming convention

```
{enemyType}_{state}_{variation}_{index}.{format}

Exemples :
- imp_idle_breathing_01.ogg
- tough_imp_attack_roar_02.mp3
- alpha_imp_death_final_01.wav
```

## Optimisations de performance

### System Level of Detail (LOD)

```typescript
// Distance-based LOD
const LOD_CONFIG = {
  close: 0-30,     // Audio complet, effets avancés
  medium: 30-80,   // Audio standard, effets réduits
  far: 80-120,     // Audio basique uniquement
  silent: 120+,    // Aucun audio
};
```

### Pool d'objets audio

- **Pool size** : 10 sons maximum par type d'ennemi
- **Réutilisation** : Sons recyclés après lecture
- **Cleanup** : Nettoyage automatique toutes les 5 secondes
- **Memory limit** : 50MB de cache audio maximum

### Métriques de performance

```typescript
const stats = audioSystem.getStats();
console.log(`
Active audio sources: ${stats.activeAudioSources}
Avg update time: ${stats.avgAudioUpdateTime}ms
Memory usage: ${stats.audioPoolMemoryUsage / 1024 / 1024}MB
`);
```

## Fallbacks et placeholders

### Génération procédurale

En l'absence de fichiers audio réels, le système génère automatiquement des sons placeholders :

```typescript
// Sons générés selon le type
'roar' → Grognement grave avec bruit
'grunt' → Son percussif court
'footstep' → Bruit sourd rythmé
'breathing' → Son ambiant doux
'scream' → Cri aigu avec decay
```

### Durées par défaut

- **Respiration/Ambiance** : 4-5 secondes
- **Pas/Actions courtes** : 0.3 secondes
- **Grognements/Douleur** : 1-2 secondes
- **Cris/Mort** : 2-3 secondes

## Debug et monitoring

### Mode debug

```typescript
const audioSystem = new EnemyAudioSystem(scene, { debug: true });
const audioManager = new EnemyAudioManager(scene, { debug: true });

// Logs console :
// [ENEMY_AUDIO] Triggered imp_attack_01 for state ATTACK at intensity 1.0
// [ENEMY_AUDIO_MANAGER] Loaded 15 sounds for imp
```

### Métriques en temps réel

```typescript
// Statistiques système
const systemStats = audioSystem.getStats();

// Statistiques cache
const cacheStats = audioManager.getCacheStats();

// Statistiques composant
const componentStats = EnemyAudioUtils.getComponentStats(audioComponent);
```

## Tests

### Tests unitaires

```bash
# Tests composant audio
pnpm test enemy-audio-component.test.ts

# Tests système audio
pnpm test enemy-audio-system.test.ts

# Tests gestionnaire d'assets
pnpm test enemy-audio-manager.test.ts
```

### Tests d'intégration

```bash
# Test intégration FSM → Audio
pnpm test integration/fsm-audio.test.ts

# Test performance (50+ ennemis)
pnpm test performance/audio-system.test.ts
```

## Troubleshooting

### Problèmes courants

1. **Audio ne se déclenche pas**
   - Vérifier que `audioComponent.isEnabled = true`
   - Vérifier la distance avec `audioComponent.distanceToListener`
   - Contrôler le cooldown avec `audioComponent.lastTriggerTime`

2. **Performance dégradée**
   - Réduire le nombre d'ennemis actifs
   - Augmenter la distance de culling audio
   - Vérifier les métriques avec `getStats()`

3. **Sons absents/placeholders**
   - Vérifier la structure des assets dans `/assets/audio/enemies/`
   - Contrôler le `manifest.json`
   - Activer le debug pour voir les tentatives de chargement

### Configuration recommandée

```typescript
// Configuration production optimisée
const PRODUCTION_CONFIG = {
  maxActiveEnemies: 20,      // Limite d'ennemis avec audio
  audioLODDistance: 100,     // Distance LOD audio
  masterVolume: 0.7,         // Volume maître
  spatialAudioEnabled: true, // Audio 3D activé
  debug: false,              // Debug désactivé
};
```

## Extensions futures

- Support VR/AR avec audio binauralm
- Occlusion audio (obstacles bloquent le son)
- Réverbération dynamique selon l'environnement
- Audio adaptatif selon la difficulté
- Mixing audio intelligent (ducking automatique)