# Enemy System Integration Guide

## 🎯 Vue d'ensemble

Ce guide technique détaille l'intégration du système d'ennemis (Phases 1-2 ✅) avec le moteur 3D Babylon.js et les autres systèmes du jeu. Il sert de référence pour les développeurs travaillant sur la Phase 3.

**Audience** : Développeurs familiers avec l'architecture ECS et Babylon.js  
**Prérequis** : Lecture de `ENEMY_SYSTEM.md` et `CLAUDE.md`

---

## 🏗️ Architecture Actuelle vs Cible

### État Actuel (Phases 1-2) ✅
```typescript
// Système autonome avec composants logiques
EnemyIdentityComponent + EnemyStateComponent + EnemyStatsComponent
         ↓
EnemyAISystem + EnemyMovementSystem + EnemyCombatSystem
         ↓
Console logs + Debug metrics (pas de rendu visuel)
```

### Architecture Cible (Phase 3) 🎯
```typescript
// Intégration complète moteur 3D
Composants ECS existants + EnemyRenderComponent + EnemyAudioComponent
         ↓
Systèmes existants + EnemyRenderSystem + Audio3DManager
         ↓
SceneManager (Babylon.js) → Rendu visuel + Audio spatialisé
```

---

## 🔌 Points d'Intégration Clés

### 1. SceneManager Integration

**Fichier** : `packages/engine/src/core/scene-manager.ts`

Le SceneManager existant gère le rendu 3D avec Babylon.js et doit être étendu pour supporter les ennemis.

#### Integration Points
```typescript
export class SceneManager {
  // Existant
  private bspTree: BSPTree;
  private scene: Scene;
  private camera: FreeCamera;
  
  // À ajouter Phase 3
  private enemyRenderSystem: EnemyRenderSystem;
  private enemyAudioManager: EnemyAudioManager;
  
  // Hook dans render loop existant
  public update(deltaTime: number): void {
    // Logic existante...
    
    // NOUVEAU: Update ennemis après BSP/physics
    this.enemyRenderSystem.update(this.entities, deltaTime);
    this.enemyAudioManager.update(this.entities, deltaTime);
  }
}
```

#### Architecture Impact
- **Performance** : Ennemis intégrés dans culling BSP existant
- **Rendering** : Pipeline unifié avec secteurs/walls
- **Audio** : Spatialisation cohérente avec ambience

### 2. ECS Entity Integration

**Challenge** : Le SceneManager actuel ne gère pas d'entités ECS explicites.

#### Solution Hybride
```typescript
// Adapter pattern entre ECS entities et Babylon.js
export class EnemySceneAdapter {
  private scene: Scene;
  private entityMeshMap: Map<string, Mesh> = new Map();
  
  syncEntitiesToScene(entities: Entity[]): void {
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const renderComponent = entity.components.get('enemyRender');
        const transform = entity.components.get('transform');
        
        // Sync ECS → Babylon.js
        this.updateMeshFromEntity(entity.id, renderComponent, transform);
      }
    }
  }
}
```

### 3. Asset Pipeline Integration

**Fichier** : `packages/engine/src/assets/`

L'asset system existant gère textures/WAD loading. Extension pour sprites ennemis.

#### Sprite System
```typescript
// Extension du TextureManager existant
export class EnemySpriteManager {
  constructor(private textureManager: TextureManager) {}
  
  // 8-direction sprites à la DOOM
  loadEnemySprites(enemyType: EnemyType): Promise<SpriteSheet> {
    const spritePaths = this.generateSpritePaths(enemyType);
    return this.textureManager.createAtlas(spritePaths);
  }
  
  // Integration avec billboard system
  getBillboardSprite(enemyType: EnemyType, direction: number, state: EnemyState): Texture {
    // Logic 8-direction + state animation
  }
}
```

---

## 🎨 Rendering Integration

### Billboard System Architecture

**Inspiration** : Système DOOM classique avec sprites 8-directions

#### Direction Mapping
```typescript
enum SpriteDirection {
  FRONT = 0,      // 0°   - Face au joueur
  FRONT_RIGHT = 1, // 45°  - Diagonal avant-droite
  RIGHT = 2,      // 90°  - Profil droit
  BACK_RIGHT = 3, // 135° - Diagonal arrière-droite
  BACK = 4,       // 180° - Dos au joueur
  BACK_LEFT = 5,  // 225° - Diagonal arrière-gauche
  LEFT = 6,       // 270° - Profil gauche
  FRONT_LEFT = 7  // 315° - Diagonal avant-gauche
}
```

#### Sprite-to-FSM Mapping
```typescript
// Chaque état FSM → sprites spécifiques
const SPRITE_MAPPINGS = {
  [EnemyState.IDLE]: 'imp_idle_{direction}.png',
  [EnemyState.SEEKING]: 'imp_walk_{direction}_{frame}.png',
  [EnemyState.CHASE]: 'imp_run_{direction}_{frame}.png',
  [EnemyState.ATTACK]: 'imp_attack_{direction}_{frame}.png',
  [EnemyState.HURT]: 'imp_pain_{direction}.png',
  [EnemyState.DEATH]: 'imp_death_{frame}.png' // Pas de direction
};
```

#### EnemyRenderComponent
```typescript
export interface EnemyRenderComponent {
  // Babylon.js objects
  mesh: Mesh | null;
  material: StandardMaterial | null;
  
  // Billboard configuration
  billboardMode: BillboardMode;
  spriteSheet: SpriteSheet;
  
  // Animation state
  currentFrame: number;
  animationSpeed: number;
  lastFrameTime: number;
  
  // LOD system
  lodLevel: LODLevel;
  cullingDistance: number;
  
  // Debug
  showBounds: boolean;
  wireframe: boolean;
}
```

#### EnemyRenderSystem
```typescript
export class EnemyRenderSystem implements System {
  constructor(
    private scene: Scene,
    private spriteManager: EnemySpriteManager,
    private camera: Camera
  ) {}
  
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        this.updateEnemyRendering(entity, deltaTime);
      }
    }
  }
  
  private updateEnemyRendering(entity: Entity, deltaTime: number): void {
    const render = entity.components.get('enemyRender') as EnemyRenderComponent;
    const state = entity.components.get('enemyState') as EnemyStateComponent;
    const transform = entity.components.get('transform') as Transform;
    
    // 1. Calculer direction billboard vs camera
    const direction = this.calculateSpriteDirection(transform, this.camera);
    
    // 2. Update sprite basé sur FSM state + direction
    const spriteFrame = this.getSpriteFrame(state.currentState, direction);
    this.updateMeshTexture(render, spriteFrame);
    
    // 3. Update position/rotation mesh
    this.syncTransformToMesh(render.mesh, transform);
    
    // 4. LOD/Culling
    this.updateLOD(render, transform, this.camera);
  }
}
```

### Performance Considerations

#### Culling Integration
```typescript
// Integration avec BSP culling existant
public updateRenderMetrics(): RenderMetrics {
  return {
    // Métriques existantes
    frameTime: this.frameTime,
    bspTraversalTime: this.bspTraversalTime,
    renderedSectors: this.visibleSectors.length,
    
    // NOUVELLES métriques ennemis
    renderedEnemies: this.visibleEnemies.length,
    culledEnemies: this.totalEnemies - this.visibleEnemies.length,
    enemyRenderTime: this.enemyRenderSystem.getLastFrameTime()
  };
}
```

#### LOD System
```typescript
enum LODLevel {
  HIGH = 0,    // < 20m : Full sprites + animations
  MEDIUM = 1,  // < 50m : Reduced animation frames
  LOW = 2,     // < 100m: Static sprites only
  CULLED = 3   // > 100m: No rendering
}
```

---

## 🔊 Audio 3D Integration

### Web Audio API Integration

#### EnemyAudioComponent
```typescript
export interface EnemyAudioComponent {
  // Audio context (shared)
  audioContext: AudioContext;
  
  // 3D Spatializer
  panner: PannerNode;
  gainNode: GainNode;
  
  // Audio sources per state
  audioSources: Map<EnemyState, AudioBuffer[]>;
  
  // Current playback
  currentSource: AudioBufferSourceNode | null;
  
  // 3D Settings
  position: Vector3;
  maxDistance: number;
  rolloffFactor: number;
  
  // State
  isPlaying: boolean;
  currentVolume: number;
}
```

#### Audio State Triggers
```typescript
// Integration avec EnemyAISystem pour déclencher sons
export class EnemyAudioManager {
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const audioComp = entity.components.get('enemyAudio');
        const stateComp = entity.components.get('enemyState');
        const transform = entity.components.get('transform');
        
        // Trigger son si changement d'état
        if (stateComp.stateChanged) {
          this.triggerStateSound(audioComp, stateComp.currentState);
        }
        
        // Update position 3D
        this.updateAudioPosition(audioComp, transform);
      }
    }
  }
}
```

#### Performance Optimizations
- **Audio Pooling** : Réutilisation AudioBufferSource
- **Distance Culling** : Pas de calculs audio > maxDistance
- **Occlusion** : Simplified geometric occlusion vs walls

---

## 🗺️ Map Collision Integration

### Challenge Principal
Le système actuel utilise `world bounds` simplifiés. La Phase 3 doit intégrer la géométrie réelle via BSP tree.

#### Current State
```typescript
// EnemyMovementSystem - collision simple
private checkWorldBounds(transform: Transform): void {
  // Hard-coded world limits
  if (transform.x < -50 || transform.x > 50) {
    // Reverse direction
  }
}
```

#### Target State
```typescript
// EnemyMovementSystem - collision réelle
private checkMapCollision(transform: Transform, velocity: Vector3): Vector3 {
  // Ray cast contre BSP geometry
  const ray = new Ray(currentPos, velocity.normalize());
  const hit = this.bspTree.intersectRay(ray, velocity.length());
  
  if (hit) {
    // Slide along wall + pathfinding
    return this.calculateSlideVector(velocity, hit.normal);
  }
  
  return velocity;
}
```

### BSP Tree Integration

#### Collision Detection
```typescript
export interface EnemyCollisionSystem {
  constructor(private bspTree: BSPTree) {}
  
  checkCollision(start: Vector3, end: Vector3): CollisionResult {
    // Utilise BSP existant pour collision linedefs
    const segments = this.bspTree.getCollidingSegments(start, end);
    
    for (const segment of segments) {
      const intersection = this.lineIntersection(start, end, segment);
      if (intersection) {
        return {
          hit: true,
          point: intersection.point,
          normal: intersection.normal,
          distance: intersection.distance
        };
      }
    }
    
    return { hit: false };
  }
}
```

#### Pathfinding A*
```typescript
// Navigation intelligente entre secteurs
export class EnemyPathfinding {
  constructor(private bspTree: BSPTree) {}
  
  findPath(start: Vector3, goal: Vector3): Vector3[] {
    // A* sur graph des secteurs connectés
    const startSector = this.bspTree.findSector(start);
    const goalSector = this.bspTree.findSector(goal);
    
    if (startSector === goalSector) {
      return [goal]; // Direct path
    }
    
    // A* implementation
    return this.aStar(startSector, goalSector);
  }
}
```

---

## 👁️ Line-of-Sight Raycasting

### Current vs Target

#### Current (Distance-only)
```typescript
// EnemyAISystem - LOS simplifié
private hasLineOfSight(enemyPos: Vector3, playerPos: Vector3): boolean {
  const distance = Vector3.Distance(enemyPos, playerPos);
  return distance < this.maxSightRange; // Pas de obstacles
}
```

#### Target (Raycasting)
```typescript
// EnemyAISystem - LOS production
private hasLineOfSight(enemyPos: Vector3, playerPos: Vector3): boolean {
  const distance = Vector3.Distance(enemyPos, playerPos);
  if (distance > this.maxSightRange) return false;
  
  // Ray cast contre géométrie map
  const ray = new Ray(enemyPos, playerPos.subtract(enemyPos).normalize());
  const hit = this.bspTree.intersectRay(ray, distance);
  
  return !hit; // LOS clair si pas d'intersection
}
```

### Performance Optimizations

#### Caching Strategy
```typescript
export class LOSCache {
  private cache: Map<string, LOSResult> = new Map();
  private cacheTimeout = 100; // ms
  
  getCachedLOS(enemyId: string, playerPos: Vector3): LOSResult | null {
    const key = `${enemyId}_${playerPos.x}_${playerPos.z}`;
    const cached = this.cache.get(key);
    
    if (cached && (performance.now() - cached.timestamp < this.cacheTimeout)) {
      return cached;
    }
    
    return null;
  }
}
```

#### Multi-ray Sampling
```typescript
// Précision vs performance trade-off
private hasLineOfSightMultiRay(enemyPos: Vector3, playerPos: Vector3): boolean {
  const rays = [
    playerPos, // Centre
    playerPos.add(new Vector3(0.5, 0, 0)), // Gauche
    playerPos.add(new Vector3(-0.5, 0, 0)) // Droite
  ];
  
  // LOS OK si au moins 1 ray libre
  return rays.some(target => this.hasLineOfSightSingle(enemyPos, target));
}
```

---

## ❤️ Player Health Integration

### Challenge
Localiser et interfacer avec le système de santé joueur existant.

#### Investigation Points
```typescript
// À rechercher dans le codebase
packages/game-logic/src/components.ts // PlayerHealthComponent ?
packages/engine/src/core/ // Health system ?
apps/web/src/ // UI health bar ?
```

#### Integration Pattern
```typescript
// EnemyCombatSystem modification
export class EnemyCombatSystem {
  private playerHealthSystem: PlayerHealthSystem | null = null;
  
  setPlayerHealthSystem(healthSystem: PlayerHealthSystem): void {
    this.playerHealthSystem = healthSystem;
  }
  
  private dealDamageToPlayer(damage: number, damageType: DamageType): void {
    if (this.playerHealthSystem) {
      // Application réelle des dégâts
      this.playerHealthSystem.takeDamage(damage, damageType);
    } else {
      // Fallback logging actuel
      Logger.log('ENEMY_COMBAT', `Player would take ${damage} damage`);
    }
  }
}
```

---

## 📊 Performance Monitoring

### Métriques Integration

#### Extended RenderMetrics
```typescript
export interface ExtendedRenderMetrics extends RenderMetrics {
  // Nouvelles métriques Phase 3
  enemyMetrics: {
    totalEnemies: number;
    renderedEnemies: number;
    culledEnemies: number;
    animatedEnemies: number;
    audioActiveEnemies: number;
  };
  
  performanceMetrics: {
    enemyRenderTime: number;
    enemyAudioTime: number;
    enemyCollisionTime: number;
    enemyLOSTime: number;
  };
}
```

#### Performance Targets
```typescript
const PERFORMANCE_TARGETS = {
  maxEnemies: 20,
  targetFPS: 60,
  maxEnemyRenderTime: 2.0, // ms
  maxEnemyAudioLatency: 50, // ms
  maxMemoryOverhead: 16 * 1024 * 1024 // 16MB
};
```

---

## 🧪 Testing Strategy

### Integration Tests
```typescript
describe('Enemy Integration', () => {
  test('Babylon.js scene integration', () => {
    // Setup scene avec ennemis
    const scene = createTestScene();
    const enemies = createTestEnemies(5);
    
    // Vérify rendering pipeline
    enemyRenderSystem.update(enemies, 16);
    
    expect(scene.meshes.length).toBe(5);
    expect(getAllEnemyMeshes().every(m => m.isVisible)).toBe(true);
  });
  
  test('Audio 3D spatialisation', () => {
    // Test audio positioning
    const enemy = createTestEnemy(new Vector3(10, 0, 0));
    const listener = new Vector3(0, 0, 0);
    
    enemyAudioManager.update([enemy], 16);
    
    const audioComp = enemy.components.get('enemyAudio');
    expect(audioComp.panner.positionX.value).toBe(10);
  });
  
  test('Performance benchmarks', () => {
    const enemies = createTestEnemies(20);
    
    const startTime = performance.now();
    enemyRenderSystem.update(enemies, 16);
    const renderTime = performance.now() - startTime;
    
    expect(renderTime).toBeLessThan(2); // < 2ms
  });
});
```

### Visual Regression Tests
```typescript
// Playwright E2E pour validation visuelle
test('Enemy sprites render correctly', async ({ page }) => {
  await page.goto('/game/enemy-test');
  
  // Screenshot comparison
  await expect(page.locator('#game-canvas')).toHaveScreenshot('enemies-idle.png');
  
  // Trigger FSM state change
  await page.click('#trigger-chase');
  await expect(page.locator('#game-canvas')).toHaveScreenshot('enemies-chase.png');
});
```

---

## 🚀 Migration Strategy

### Phase 3 Rollout Plan

#### Étape 1: Foundation (Semaine 1)
1. **Setup EnemyRenderComponent** interface
2. **Babylon.js scene adapter** création  
3. **Sprite system** foundation
4. **Basic billboard** rendering

#### Étape 2: Integration (Semaine 2) 
1. **SceneManager** modification complète
2. **Audio 3D** system implementation
3. **Performance profiling** setup
4. **Unit tests** pour nouveaux composants

#### Étape 3: Advanced (Semaine 3)
1. **Map collision** BSP integration
2. **Line-of-sight** raycasting 
3. **Player health** interface
4. **Pathfinding** A* implementation

#### Étape 4: Polish (Semaine 4)
1. **Performance optimization** final
2. **Visual/Audio** polish
3. **Integration tests** complets
4. **Documentation** finale

### Rollback Strategy
- **Feature flags** pour désactiver rendering
- **Fallback** vers système console-only
- **Performance gates** automatiques
- **Staged deployment** par sub-feature

---

## 📋 Checklist Développeur

### Avant de commencer
- [ ] Lire `ENEMY_SYSTEM.md` complètement
- [ ] Comprendre architecture BSP existante
- [ ] Setup environnement Babylon.js dev
- [ ] Familiariser avec pipeline asset existant

### Pendant développement
- [ ] Respecter patterns ECS existants
- [ ] Maintenir performance 60fps target
- [ ] Ajouter tests pour chaque nouveau système
- [ ] Profiler memory usage régulièrement
- [ ] Documenter décisions techniques

### Avant merge
- [ ] Tests unitaires 95%+ coverage
- [ ] Performance benchmarks validés  
- [ ] Cross-browser compatibility WebGPU/WebGL2
- [ ] Documentation mise à jour
- [ ] Code review team passée

---

**Dernière mise à jour** : 2025-01-09  
**Version** : Phase 3 Setup  
**Contributeurs** : Claude Code

*Ce guide évolue avec l'implémentation. Pour questions/clarifications, voir `ENEMY_PHASE3_ROADMAP.md`.*