# Enemy System - Phase 3 Roadmap

## 🎯 Vue d'ensemble Phase 3 : Production Integration & Polish

**Objectif principal** : Transformer le système d'ennemis autonome (Phase 1-2 ✅) en système intégré production-ready avec rendu 3D, audio spatialisé, et navigation map complète.

**Statut Global** : 🟡 **EN COURS** - Démarré le 2025-01-09  
**Durée estimée** : 3-4 semaines  
**Complexité** : Élevée (intégration multi-systèmes)

---

## 📊 Progress Tracker Global

| Phase | Statut | Progression | Durée Estimée | Durée Réelle | Bloqueurs |
|-------|--------|-------------|---------------|--------------|-----------|
| **Phase 3 Setup** | 🟡 En cours | 25% (1/4) | 1 jour | - | - |
| **Babylon.js Render** | ⏸️ Attente | 0% | 5-7 jours | - | - |
| **Audio 3D** | ⏸️ Attente | 0% | 3-4 jours | - | - |
| **Map Collision** | ⏸️ Attente | 0% | 4-5 jours | - | - |
| **Raycast LOS** | ⏸️ Attente | 0% | 3-4 jours | - | - |
| **Health Integration** | ⏸️ Attente | 0% | 2-3 jours | - | - |
| **Performance** | ⏸️ Attente | 0% | 2-3 jours | - | - |
| **Testing & QA** | ⏸️ Attente | 0% | 2-3 jours | - | - |

**Progression totale** : 3% (1/30 tâches majeures)

---

## 🏗️ Structure de Branches

```
develop (base)
└── feature/enemy-phase3-integration ← Branche principale Phase 3
    ├── feature/enemy-babylon-rendering   (Sub-feature 1)
    ├── feature/enemy-audio-3d           (Sub-feature 2) 
    ├── feature/enemy-map-collision      (Sub-feature 3)
    ├── feature/enemy-raycast-los        (Sub-feature 4)
    └── feature/enemy-health-integration (Sub-feature 5)
```

**Branche actuelle** : `develop`  
**Prochaine branche** : `feature/enemy-phase3-integration` (à créer)

---

## 📋 Détail des Tâches

### 🚀 **Phase 3.0 : Setup & Documentation** 
*Durée : 1 jour | Priorité : Critique*

#### Tâches Setup
- [x] ~~Créer ENEMY_PHASE3_ROADMAP.md~~ ✅ 2025-01-09
- [ ] Créer branche `feature/enemy-phase3-integration`
- [ ] Mettre à jour ENEMY_SYSTEM.md avec Phase 3 status
- [ ] Créer docs/ENEMY_INTEGRATION_GUIDE.md

**Status** : 🟡 **25% complété** (1/4 tâches)

---

### 🎨 **Phase 3.1 : Babylon.js Rendering Integration**
*Durée : 5-7 jours | Priorité : Haute | Dépendance : Setup*

#### Architecture Rendering
- [ ] **EnemyRenderComponent** : Nouveau composant pour rendu 3D
  - [ ] Interface avec Babylon.js Mesh/Sprite
  - [ ] Support billboard 8-directions DOOM-style
  - [ ] Animation states mapping FSM
  - [ ] LOD levels (High/Medium/Low/Culled)

- [ ] **EnemyRenderSystem** : Système de rendu intégré
  - [ ] Intégration pipeline SceneManager existant
  - [ ] Culling via BSP tree comme géométrie
  - [ ] Animation controller FSM → visuel
  - [ ] Performance profiling

#### Livrables Rendering
- [ ] `packages/enemies/src/components/enemy-render-component.ts`
- [ ] `packages/enemies/src/systems/enemy-render-system.ts` 
- [ ] Modification `packages/engine/src/core/scene-manager.ts`
- [ ] Tests unitaires système rendu
- [ ] Assets placeholder Imp sprite 8-dir

**Status** : ⏸️ **Attente Setup** | **Bloqueurs** : Setup incomplet

---

### 🔊 **Phase 3.2 : Audio 3D Spatialisé**
*Durée : 3-4 jours | Priorité : Moyenne | Dépendance : Rendering*

#### Architecture Audio
- [ ] **EnemyAudioComponent** : Gestion sons spatialisés
  - [ ] Web Audio API 3D integration
  - [ ] AudioPanner par ennemi
  - [ ] Occlusion/réverbération dynamique
  - [ ] Volume/pitch variations

- [ ] **Sons par état FSM**
  - [ ] IDLE : Breathing/ambient
  - [ ] SEEKING : Footsteps
  - [ ] CHASE : Aggressive sounds
  - [ ] ATTACK : Attack sounds
  - [ ] HURT : Pain sounds  
  - [ ] DEATH : Death sounds

#### Livrables Audio
- [ ] `packages/enemies/src/components/enemy-audio-component.ts`
- [ ] Integration dans EnemyAISystem pour triggers
- [ ] Assets audio placeholder Imp
- [ ] Tests automatisés audio 3D
- [ ] Performance benchmarks audio

**Status** : ⏸️ **Attente Rendering** | **Bloqueurs** : Rendering non commencé

---

### 🗺️ **Phase 3.3 : Map Collision Integration**
*Durée : 4-5 jours | Priorité : Haute | Dépendance : Engine*

#### Remplacement Collision Système
- [ ] **BSP Tree Integration** 
  - [ ] Remplacement world bounds par géométrie réelle
  - [ ] Collision vs linedefs/walls
  - [ ] Sector boundaries detection
  - [ ] Performance optimisations

- [ ] **Pathfinding Avancé**
  - [ ] A* algorithm pour navigation secteurs
  - [ ] Path smoothing
  - [ ] Dynamic obstacle avoidance
  - [ ] Stuck detection améliorée

#### Livrables Collision
- [ ] Modification `EnemyMovementSystem` collision logic
- [ ] Integration BSP tree dans movement
- [ ] Debug visualisation collision bounds
- [ ] Tests pathfinding complexes
- [ ] Performance comparaison avant/après

**Status** : ⏸️ **Attente Engine** | **Bloqueurs** : Architecture engine à comprendre

---

### 👁️ **Phase 3.4 : Production Line-of-Sight** 
*Durée : 3-4 jours | Priorité : Haute | Dépendance : Map Collision*

#### Remplacement Distance-Only LOS
- [ ] **Raycasting System**
  - [ ] Ray vs map geometry intersection
  - [ ] Multi-ray sampling (précision/performance)
  - [ ] Cache résultats LOS (performance)
  - [ ] Obstacles dynamiques support

- [ ] **AI Integration**
  - [ ] Remplacement dans EnemyAISystem
  - [ ] Gradual sight loss (réalisme)
  - [ ] Peripheral vision simulation
  - [ ] Debug rays visualisation

#### Livrables LOS
- [ ] Nouveau module `line-of-sight-system.ts`
- [ ] Integration dans `EnemyAISystem`
- [ ] Performance benchmarks raycasting
- [ ] Tests edge cases (corners, doors)
- [ ] Visual debug mode

**Status** : ⏸️ **Attente Collision** | **Bloqueurs** : Map collision requis

---

### ❤️ **Phase 3.5 : Player Health Integration** 
*Durée : 2-3 jours | Priorité : Moyenne | Dépendance : Engine*

#### Damage Events → Player Health
- [ ] **Interface Santé Joueur**
  - [ ] Connection events damage → health system
  - [ ] Damage types (melee, projectile, etc.)
  - [ ] Damage resistance/armor support
  - [ ] Death handling

- [ ] **UI/UX Feedback**  
  - [ ] Damage indicators visuels
  - [ ] Screen flash effects
  - [ ] Health bar integration
  - [ ] Audio feedback damage

#### Livrables Health
- [ ] Interface player health dans EnemyCombatSystem
- [ ] UI damage feedback system
- [ ] Balancing damage values
- [ ] Tests intégration health
- [ ] Documentation API damage

**Status** : ⏸️ **Attente Engine** | **Bloqueurs** : Player health system à localiser

---

### ⚡ **Phase 3.6 : Performance & Optimisation**
*Durée : 2-3 jours | Priorité : Haute | Dépendance : Tous systèmes*

#### Profiling & Optimisation
- [ ] **Babylon.js Performance**
  - [ ] Frame timing analysis
  - [ ] Memory usage profiling  
  - [ ] GPU utilization monitoring
  - [ ] Batch rendering optimisations

- [ ] **Object Pooling**
  - [ ] Mesh pooling réutilisation
  - [ ] Audio sources pooling
  - [ ] Particle effects pooling
  - [ ] Automatic cleanup

#### Métriques Cibles
- [ ] **60 FPS stable** avec 20+ ennemis actifs
- [ ] **< 2ms** overhead render ennemis par frame
- [ ] **< 16MB** mémoire additionnelle
- [ ] **< 50ms** latence audio events

**Status** : ⏸️ **Attente Intégrations** | **Bloqueurs** : Systèmes incomplets

---

### 🧪 **Phase 3.7 : Testing & Quality Assurance**
*Durée : 2-3 jours | Priorité : Critique | Dépendance : Performance*

#### Tests Complets
- [ ] **Tests Unitaires**
  - [ ] Couverture 95%+ maintenue
  - [ ] Tests composants rendering/audio
  - [ ] Mocks Babylon.js appropriés
  - [ ] Tests performance automatisés

- [ ] **Tests Intégration**
  - [ ] Scénarios multi-ennemis
  - [ ] Tests cross-browser WebGPU/WebGL2
  - [ ] Tests regression performance
  - [ ] Validation visuelle/audio

- [ ] **Documentation Finale**
  - [ ] Mise à jour ENEMY_SYSTEM.md
  - [ ] API documentation complète
  - [ ] Guide développeur intégration
  - [ ] Changelog détaillé Phase 3

**Status** : ⏸️ **Attente Performance** | **Bloqueurs** : Performance non validée

---

## 📈 Métriques & KPIs

### Performance Targets
| Métrique | Objectif | Actuel | Status |
|----------|----------|--------|--------|
| FPS (20 ennemis) | 60 FPS | - | ⏸️ |
| Render overhead | < 2ms | - | ⏸️ |
| Memory usage | < 16MB | - | ⏸️ |
| Audio latency | < 50ms | - | ⏸️ |
| Test coverage | 95%+ | - | ⏸️ |

### Integration Status
| Système | Phase 1-2 | Phase 3 | Integration |
|---------|-----------|---------|-------------|
| ECS Core | ✅ Complet | - | ⏸️ Attente |
| AI System | ✅ Complet | ⏸️ LOS upgrade | ⏸️ Attente |
| Movement | ✅ Complet | ⏸️ Map collision | ⏸️ Attente |
| Combat | ✅ Complet | ⏸️ Health integration | ⏸️ Attente |
| Rendering | ❌ Absent | ⏸️ À implémenter | ⏸️ Attente |
| Audio | ❌ Absent | ⏸️ À implémenter | ⏸️ Attente |

---

## 🚧 Risques & Mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| **Performance Babylon.js** | Élevée | Critique | Profiling précoce, LOD agressif |
| **Memory leaks rendering** | Moyenne | Élevé | Tests automatisés, pooling objects |
| **Audio Web API complexité** | Moyenne | Moyen | Prototype rapide, fallbacks |
| **BSP integration difficile** | Faible | Élevé | Architecture review, tests |
| **Scope creep features** | Élevée | Moyen | Focus MVP, defer nice-to-have |

---

## 📝 Notes de Développement

### Décisions Techniques Clés
- **Rendering** : Billboard sprites vs full 3D models (TBD)
- **Audio** : Web Audio API vs bibliothèque tierce (TBD) 
- **Pathfinding** : A* vs navmesh vs simple LOS (TBD)
- **Performance** : Object pooling vs garbage collection (TBD)

### Blockers Actuels
1. **Architecture Engine** : Comprendre integration SceneManager
2. **Player Health** : Localiser système santé joueur existant  
3. **Asset Pipeline** : Définir format sprites/audio ennemis

### Prochaines Actions
1. ✅ Finaliser setup documentation (ce fichier)
2. 🔄 Créer branche principale Phase 3
3. ⏸️ Analyser architecture SceneManager pour integration
4. ⏸️ Commencer EnemyRenderComponent prototype

---

## 🎯 Définition of Done - Phase 3

La Phase 3 sera considérée **COMPLÈTE** quand :

### ✅ Fonctionnel
- [ ] Ennemis Imp visibles en 3D avec animations
- [ ] Audio 3D spatialisé fonctionnel
- [ ] Navigation map réelle (pas world bounds)
- [ ] Line-of-sight avec raycasting
- [ ] Dégâts appliqués au joueur

### ✅ Performance  
- [ ] 60 FPS stable 20+ ennemis
- [ ] Pas de memory leaks détectés
- [ ] Métriques performance validées

### ✅ Qualité
- [ ] 95%+ test coverage maintenu
- [ ] 0 régressions engine existant
- [ ] Documentation complète
- [ ] Code reviews passées

### ✅ Integration
- [ ] Compatible WebGPU/WebGL2
- [ ] Intégré pipeline build existant
- [ ] Déployable avec apps/web

---

**Dernière mise à jour** : 2025-01-09  
**Prochain milestone** : Setup complet + Branche création  
**Assigné** : Claude Code  
**Priorité** : Haute

---

*Ce fichier est mis à jour automatiquement à chaque milestone. Pour questions/blockers, voir section Notes de Développement.*