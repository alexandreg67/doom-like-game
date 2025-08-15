# Instructions Copilot pour ce repo

But: rendre un agent AI immédiatement productif sur ce monorepo TypeScript (pnpm) d’un jeu DOOM-like (Babylon.js) avec rendu WebGPU/WebGL2, ECS simple et éditeur de carte.

## Vue d’ensemble de l’architecture

- Monorepo pnpm: `packages/*` (modules réutilisables) et `apps/web` (app Vite)
  - `packages/engine`: moteur (Babylon.js), wrapper Renderer (WebGPU → fallback WebGL), SceneManager, géométrie DOOM-like, BSP
  - `packages/game-logic`: ECS minimal (création entités, boucle systèmes)
  - `packages/assets`: loaders (textures/audio/WAD – WAD WIP), atlas/son
  - `packages/map-editor`: base éditeur 2D (WIP)
- Entrée app: `apps/web/src/main.ts` crée `Engine(config) → await engine.initialize() → engine.start()` et affiche infos renderer/FPS.
- Aliases Vite (dev sur sources): dans `apps/web/vite.config.ts` les imports `@doom-like/*` pointent vers `packages/*/src`.

## Workflows développeur (pnpm@9, Node 20)

- Démarrer: `pnpm install` puis `pnpm dev` (sert `apps/web` sur http://localhost:5173)
- Build: `pnpm build` (build engine puis web)
- Unit tests (Vitest jsdom): `pnpm test` (couvre principalement `packages/engine`)
- E2E (Playwright): `pnpm test:e2e` (webServer auto, flags WebGPU Chromium déjà configurés)
- Qualité: `pnpm lint` (Biome), `pnpm format`, `pnpm typecheck`
- Hooks Git: `lefthook` lance Biome + typecheck; push direct vers `main` bloqué (voir `lefthook.yml`).

## Moteur de rendu (fichiers clés)

- `packages/engine/src/core/engine.ts`: encapsule BabylonEngine, `Renderer`, `SceneManager`, gère loop + resize.
- `packages/engine/src/rendering/renderer.ts`: choisit WebGPU si dispo sinon WebGL; expose `getCapabilities()` et type actif.
- `packages/engine/src/rendering/webgpu-renderer.ts` et `webgl-renderer.ts`: init détaillé et capabilities.
- Exigences Web: COOP/COEP ajoutés dans `apps/web/vite.config.ts` (utile WebGPU/SharedArrayBuffer).

## Géométrie DOOM-like et chargement niveau

- Types source de vérité: `packages/engine/src/geometry/doom-geometry.ts` (Sectors, LineDefs, SideDefs, Flags, BSPNode…)
- Chargement niveau: `packages/engine/src/geometry/level-loader.ts`
  - JSON → `ParsedLevel` (Map secteurs/vertices + lineDefs + playerStart)
  - Calcule bounding boxes, normals 2D des segments et voisins de secteurs
- Démo Phase 1: `packages/engine/src/fixtures/demo_level_simple.json` chargée depuis `SceneManager.createDefaultScene()`.
- Murs/sol/plafond: `SectorGeometry` (triangulation sol/plafond, `generateWallGeometry(lineDef)` pour pans upper/lower/middle).

## BSP et debug perf

- `packages/engine/src/geometry/bsp-tree.ts`: construction heuristique (équilibre + splits), seuils: `LEAF_LINE_THRESHOLD=4`, `MAX_TREE_DEPTH=20`.
- Traversal front-to-back: `traverseTree(viewpoint)` renvoie secteurs/lignes visibles.
- `SceneManager` expose: `setDebugBSP(true)` (wireframe splits), `setMetricsEnabled(true)`, `collectFrameMetrics()`/`logMetrics()`.

## Assets et cache

- `packages/engine/src/assets/asset-loader.ts`: chargement textures/audio/WAD
  - Retry avec backoff linéaire, timeout texture (10s), cache TTL par défaut 5 min (`cacheMaxAge`), `clearExpiredAssets()` automatique à l’usage.
  - Particularité Babylon Texture: `invertY` par défaut true; `samplingMode` tri-linéaire.
- `packages/assets/src/wad/wad-loader.ts`: stub (WIP) – ne pas supposer support WAD complet.

## Conventions de code (concrètes au repo)

- TypeScript strict; préférer `import type` (Biome règle `useImportType: error`).
- Importer les types Babylon via `@babylonjs/core`; vecteurs: `Vector2` pour géométrie 2D (x,z), `Vector3` pour meshes.
- Centraliser les exports publics dans `packages/*/src/index.ts`. Si vous créez un nouveau module public, ajoutez l’export ici.
- Ne pas instancier/manipuler directement des contexts WebGL – passer par `Renderer`.
- Tests unitaires: privilégier logique pure (BSP, level-loader, utils géométrie). WebGPU n’est pas dispo sous jsdom.

## Intégration app web (exemples d’usage)

- Initialisation: `const engine = new Engine(config); await engine.initialize(); engine.start();`
- Infos renderer: `engine.getRenderer().getRendererType()` et `getCapabilities()` (affichées par `apps/web/src/main.ts`).
- Interactions démo: touche `E` bascule une porte (`lineDef.id === 'l3_door'`), via `SceneManager` (flag `blocking`).

## Tests et dossiers

- Vitest racine: `vitest.config.ts` (coverage v8, env jsdom), engine a son `vitest.config.ts` local pour coverage détaillée.
- E2E: configs dans `playwright.config.ts` (racine et `apps/web/`); `testDir: tests/e2e`; webServer: `pnpm dev`.

## Notes légales et perf

- Aucuns assets DOOM originaux – n’introduisez pas d’assets protégés (voir README/CLAUDE.md).
- Objectifs perf phase 1: 60 FPS sur niveau simple; privilégier culling (BSP) et géométrie statique (freeze matrices sol/plafond).

---

Si quelque chose est ambigu (ex: format JSON niveau, surface materials, stratégie de tests), dites-le et je l’ajouterai ici pour la prochaine passe.
