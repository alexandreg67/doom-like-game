# PHASE 2 — Roadmap détaillée

Ce document reprend et affine le plan de la Phase 2 : amélioration visuelle et technique du moteur (textures, éclairage, collisions, audio, performance et outil de niveau).

Objectifs principaux

- Remplacer les couleurs par un système de textures robuste (tiling, atlas, metadata)
- Ajouter éclairage dynamique et effets atmosphériques
- Implémenter détection de collision et contrôleur joueur fluide
- Intégrer audio 3D, optimiser la perf et fournir des outils (level-editor, profiling)

Priorité immédiate — Étape 1 : Préparation & Setup

- Créer une branche de travail dédiée : `feature/phase2-start` (ou similaire par feature)
- Ajouter ce fichier `PHASE2_ROADMAP.md` à la racine (fait)
- Créer `docs/texture-system.md` (spécification du système de textures) — fait
- Mettre à jour le `README.md` pour annoncer Phase 2 et pointer vers cette roadmap
- Créer un ticket/issue par composant majeur (texture, lighting, collision, audio)

Etat actuel

- Issues principales créées sur GitHub : Textures (#8), Lighting (#9), Collision (#10), Audio (#11)
- Labels `phase2` et `enhancement` ajoutés

Owners suggérés

- Textures: @alexandreg67
- Lighting: @alexandreg67
- Collision: @alexandreg67
- Audio: @alexandreg67

Milestone

- Créer un milestone "Phase 2" et assigner les issues ci-dessus pour suivre le sprint.

Checklist Étape 1 (à cocher au fur et à mesure)

- [x] Créer branche locale `feature/phase2-start`
- [x] Ajouter `PHASE2_ROADMAP.md`
- [x] Ajouter `docs/texture-system.md`
- [ ] Ouvrir issues pour chaque module
- [ ] Ajouter templates de PR / ADR pour décisions d'architecture

Checklist mise à jour

- [x] Ouvrir issues pour chaque module (voir #8, #9, #10, #11)
- [x] Ajouter templates de PR / ADR pour décisions d'architecture
- [ ] Créer milestone "Phase 2" et assigner issues
- [ ] Ouvrir PR `feature/phase2-start` -> `develop` contenant docs + prototype `TextureManager`

Progression Sprint 1 — Textures

- [x] Issue #13 (Atlas builder) : ✅ COMPLÉTÉ — ajout d'un packer d'atlas simple (shelf packer) dans `packages/engine/src/assets/atlas-builder.ts` et tests unitaires.
- [x] **TextureManager avec cache LRU/TTL** : Implémentation complète avec éviction optimisée
- [x] **Atlas builder fonctionnel** : Shelf packer avec tests complets
- [x] **UV mapping pour sub-textures** : Support des coordonnées UV normalisées
- [x] **Intégration complète** : TextureManager intégré avec SceneManager et système d'éclairage
- [x] **Tests exhaustifs** : 133/133 tests passent, couverture > 80% sur les assets

Progression Sprint 2 — Éclairage

- [x] **Système d'éclairage de base** : Implémentation complète du `LightManager`, `SectorLightingManager` et `FogManager`
- [x] **Interface de debug** : `LightingDebugUI` avec contrôles en temps réel (F1/F2)
- [x] **Métriques de performance** : Tracking des lumières actives, shadow maps, temps de culling
- [x] **Gestion des ombres** : Support des shadow maps avec métriques précises
- [x] **Système de brouillard** : Gestion des transitions et effets atmosphériques
- [x] **Améliorations qualité code** :
  - Correction du décrément des métriques shadow maps lors de la suppression
  - Conversion radians/degrés appropriée dans l'UI de debug
  - Délégation de la gestion du brouillard au `FogManager` (suppression de duplication)
  - Évitement du spam de logs pour les transitions de brouillard
  - Corrections de linting avec template literals
- [x] **Architecture propre** : Séparation claire des responsabilités entre les managers
- [x] **TypeScript strict** : Types stricts pour toutes les configurations d'éclairage

Découpage par sprints (rappel rapide)

- Sprint 1 — Textures (infrastructure, integration, mapping UV)
- Sprint 2 — Éclairage (dynamic lights, shadows, ambiance)
- Sprint 3 — Collision & Player Controller
- Sprint 4 — Audio
- Sprint 5 — Optimisations et outils
- Sprint 6 — UI, niveaux de démo, tests, release

Notes et décisions d'architecture (à documenter en ADR)

- Utiliser TypeScript strict dans `packages/engine`
- Centraliser l'API textures dans `packages/engine/src/assets/texture-manager.ts`
- Asset loader existant (`asset-loader.ts`) s'étendra pour support atlas et priorités
- Eviter tout asset propriétaire DOOM — user assets open-source ou créations originales

État actuel du projet (Mise à jour du 15/08/2025)

**Sprint 2 - Éclairage : ✅ COMPLÉTÉ**
Le système d'éclairage est maintenant entièrement fonctionnel avec :
- Architecture solide et extensible
- Interface de debug complète
- Métriques de performance intégrées
- Code de qualité production (strict TypeScript, pas de duplication)
- Tests et validation en place

Prochaines actions proposées

**Sprint 1 - Textures : ✅ COMPLÉTÉ**
Le système de textures est maintenant entièrement finalisé avec :
- TextureManager avec cache LRU optimisé et TTL
- Atlas builder avec shelf packer performant
- Intégration complète avec le système d'éclairage
- Tests exhaustifs (133/133 passent)
- Code de qualité production

**Priorité immédiate :**
1. **Commencer Sprint 3 (Collision & Player Controller)** :
   - Design du système de collision AABB vs segments
   - Implémentation du contrôleur joueur physique
   - Prévention de traversée des murs
   - Tests d'intégration mouvement

2. **Préparer Sprint 4 (Audio)** :
   - Architecture du système audio 3D
   - Intégration avec Babylon.js Audio Engine

**Actions administratives :**
1. Créer milestone "Phase 2" et assigner les issues créées
2. Mettre à jour les issues GitHub avec le statut des éclairages (fermer #9)
3. Documenter les décisions d'architecture dans des ADR

---

Fichier généré automatiquement lors du démarrage Phase 2 — gardez-le à jour.
