# DOOM-Like Game - Documentation Technique

## Vue d'ensemble du projet

Ce projet est un jeu web moderne inspiré de DOOM, développé avec Babylon.js et TypeScript en 2025. Il respecte les contraintes légales en créant une expérience originale qui s'inspire des mécaniques de DOOM sans copier ses assets propriétaires.

## Architecture du monorepo

```
doom-like-game/
├── packages/
│   ├── engine/          # Moteur de rendu 3D (Babylon.js + WebGPU)
│   ├── game-logic/      # Logique de jeu ECS et gameplay
│   ├── map-editor/      # Éditeur de cartes web 2D
│   └── assets/          # Pipeline d'assets et format WAD-like
├── apps/
│   ├── web/             # Application web principale
│   └── docs/            # Documentation technique
└── tools/               # Scripts BSP, validation, CI
```

## Technologies utilisées

### Core
- **TypeScript 5.5+** : Typage strict, dernières features ES2022
- **Babylon.js 7.0** : Moteur 3D avec support WebGPU/WebGL2
- **pnpm workspaces** : Gestion monorepo performante
- **Vite** : Build tool rapide avec HMR

### Outils de développement
- **Biome** : Linting et formatting unifié (remplace ESLint + Prettier)
- **Lefthook** : Git hooks performants (remplace Husky)
- **Vitest** : Tests unitaires rapides
- **Playwright** : Tests E2E avec support WebGPU

### Rendu et performance
- **WebGPU** : API graphique moderne avec fallback WebGL2
- **Web Audio API** : Audio 3D spatialisé
- **SharedArrayBuffer** : Performance multi-thread (COOP/COEP requis)
- **WASM** : Optionnel pour BSP et physique intensive

## Commandes principales

### Installation et setup
```bash
# Installation des dépendances
pnpm install

# Installation des git hooks
pnpm lefthook install

# Vérification de l'environnement
pnpm typecheck
```

### Développement
```bash
# Démarrage du serveur de développement
pnpm dev

# Build de tous les packages
pnpm build

# Tests unitaires avec coverage
pnpm test

# Tests E2E
pnpm test:e2e

# Linting et formatting
pnpm lint
pnpm format
```

### Workflow Git

#### Branches
- **main** : Production stable, protégée
- **develop** : Intégration continue, base pour les features
- **feature/doom-*** : Nouvelles fonctionnalités
- **hotfix/*** : Corrections urgentes production

#### Conventions de commit
Format : `type(scope): description`
- `feat(engine): add WebGPU renderer`
- `fix(game): correct collision detection`
- `perf(rendering): optimize BSP traversal`
- `test(e2e): add level completion tests`

### Structure des packages

#### @doom-like/engine
Moteur de rendu 3D basé sur Babylon.js
- **WebGPU Renderer** : Rendu moderne haute performance
- **WebGL2 Fallback** : Compatibilité navigateurs anciens
- **Scene Manager** : Gestion des scènes et transitions
- **Asset Loader** : Chargement format WAD-like custom

#### @doom-like/game-logic  
Logique de jeu et système ECS
- **ECS System** : Entités, composants, systèmes
- **Physics 2.5D** : Collisions AABB vs segments
- **AI System** : FSM pour ennemis (idle/chase/attack)
- **Weapon System** : Hitscan et projectiles

#### @doom-like/map-editor
Éditeur de cartes web en 2D
- **2D Top-down Editor** : Interface drag & drop
- **Sector System** : Édition secteurs façon DOOM
- **WAD Export** : Export au format custom
- **BSP Generation** : Pré-calcul offline pour optimisation

#### @doom-like/assets
Pipeline d'assets et gestion ressources
- **WAD-like Format** : Format custom inspiré DOOM
- **Texture Atlas** : Optimisation GPU
- **Audio Processing** : Compression et spatialisation
- **Sprite System** : Billboard 8 directions

## APIs et intégrations

### WebGPU Detection
```typescript
const hasWebGPU = 'gpu' in navigator;
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
```

### Audio 3D
```typescript
const audioContext = new AudioContext();
const panner = audioContext.createPanner();
panner.setPosition(x, y, z);
```

### Gamepad Support
```typescript
const gamepads = navigator.getGamepads();
const gamepad = gamepads[0];
if (gamepad) {
  // Handle input
}
```

## BSP Tree Implementation

Le système BSP (Binary Space Partitioning) implémente un culling géométrique efficace pour optimiser le rendu des secteurs DOOM-like.

### Architecture BSP

```typescript
// Construction du BSP Tree
const bspTree = new BSPTree(sectors);
const stats = bspTree.getStats();
console.log(`BSP: ${stats.nodes} nodes, depth ${stats.maxDepth}`);

// Traversal pour culling
const result = bspTree.traverseTree(cameraPosition);
console.log(`Visible: ${result.visibleSectors.length} sectors`);
```

### Algorithme de Partitionnement

1. **Sélection de partition** : Heuristique basée sur l'équilibre des splits
2. **Classification géométrique** : Front/Back/Colinear/Spanning pour chaque Linedef  
3. **Construction récursive** : Arbre binaire jusqu'à seuil minimum (4 lignes)
4. **Optimisations** : Profondeur max 20, gestion des cas dégénérés

### Performance et Métriques

```typescript
// Activation des métriques détaillées
sceneManager.setMetricsEnabled(true);

// Collection des métriques par frame
const metrics = sceneManager.collectFrameMetrics();
console.log(`Frame: ${metrics.frameTime}ms, BSP: ${metrics.bspTraversalTime}ms`);

// Debug wireframe pour visualisation
sceneManager.setDebugBSP(true); // Affiche les partitions colorées
```

### Métriques de Performance

- **Construction BSP** : < 5ms pour secteurs complexes (L-shape, 15+ segments)
- **Traversal** : < 0.01ms par frame pour scènes 10+ secteurs
- **Culling efficacy** : Ratio géométrie visible/totale mesuré en temps réel
- **Mémoire** : Croissance ~O(n log n) nœuds vs secteurs

### Debug et Visualisation

```typescript
// Wireframe coloré par profondeur BSP
sceneManager.setDebugBSP(true);

// Métriques console en temps réel  
sceneManager.logMetrics();
// Output:
// [ENGINE] Performance Metrics:
//   Frame time: 0.045ms
//   BSP traversal: 0.008ms  
//   Rendered sectors: 3 / 5
//   Culling efficiency: 40.0%
```

### Tests et Validation

- **Tests unitaires** : Construction, traversal, cas edge (15 tests)
- **Benchmarks perf** : Scaling multi-secteurs, traversal 1000x (6 tests)
- **Métriques qualité** : 94% code coverage, validation géométrique

## Sécurité et performance

### Headers de sécurité requis
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'
```

### Optimisations
- **Code Splitting** : Babylon.js en chunks séparés
- **Asset Streaming** : Chargement progressif textures/sons
- **LOD System** : Niveau de détail adaptatif
- **Occlusion Culling** : BSP pour masquage géométrie

## Tests

### Tests unitaires (Vitest)
```bash
# Run all tests
pnpm test

# Tests avec UI
pnpm test:ui

# Coverage
pnpm test:coverage
```

### Tests E2E (Playwright)
```bash
# Tests sur tous navigateurs
pnpm test:e2e

# Chrome uniquement avec WebGPU
pnpm playwright test --project=chromium
```

### Benchmarks performance
```bash
# Test frame timing
pnpm test:perf

# Memory leak detection  
pnpm test:memory
```

## Build et déploiement

### Build de production
```bash
pnpm build
```

### Analyse bundle
```bash
pnpm build:analyze
```

### Variables d'environnement
```env
VITE_WEBGPU_ENABLED=true
VITE_DEBUG_MODE=false
VITE_TELEMETRY_ENDPOINT=https://api.example.com/metrics
```

## Debugging et monitoring

### Performance monitoring
- Frame timing (99e percentile < 16.7ms)
- Memory usage (heap, WebGL contexts)
- GPU utilisation
- Network bandwidth (assets)

### Logs structurés
```typescript
console.log('[ENGINE]', 'WebGPU adapter:', adapter.info);
console.log('[GAME]', 'Level loaded:', level.name, 'entities:', entities.length);
```

## Roadmap et milestones

Voir PLAN.md pour la roadmap détaillée.

### MVP (v0.1.0)
- [x] Architecture monorepo
- [x] Engine Babylon.js + WebGPU
- [ ] Mouvement joueur FPS
- [ ] Rendu secteurs/BSP basique
- [ ] 1 niveau jouable

### v1.0.0
- [ ] 5-8 niveaux complets
- [ ] Système d'armes varié
- [ ] IA ennemis intelligente
- [ ] Éditeur de cartes fonctionnel
- [ ] Audio 3D immersif

### v1.x
- [ ] Mode coopération WebRTC
- [ ] Génération procédurale
- [ ] Mode speedrun
- [ ] Support VR/AR

## Troubleshooting

### WebGPU non supporté
Le fallback WebGL2 s'active automatiquement. Pour forcer WebGL :
```typescript
const config = { preferWebGPU: false };
```

### COOP/COEP headers manquants
Nécessaires pour SharedArrayBuffer. Configurer le serveur :
```javascript
// vite.config.ts
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
  }
}
```

### Performance dégradée
1. Vérifier compatibilité WebGPU : chrome://gpu
2. Profiler avec DevTools Performance
3. Analyser memory leaks : chrome://memory-internals

## Ressources

- [Babylon.js Docs](https://doc.babylonjs.com)
- [WebGPU Spec](https://gpuweb.github.io/gpuweb/)
- [DOOM Wiki](https://doomwiki.org) (références techniques uniquement)
- [BSP Trees](https://en.wikipedia.org/wiki/Binary_space_partitioning)

## Contribution

1. Créer feature branch depuis `develop`
2. Respecter conventions commit conventionnelles
3. Tests unitaires + E2E requis
4. Code review obligatoire
5. Merge vers `develop` puis `main`

## Licence et légal

Projet original inspiré de DOOM. Aucun asset propriétaire d'id Software n'est utilisé. Seules les mécaniques de jeu (domaine public) sont reproduites avec des assets originaux.