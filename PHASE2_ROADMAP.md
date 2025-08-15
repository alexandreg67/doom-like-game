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

- [>] Issue #13 (Atlas builder) : en cours — ajout d'un packer d'atlas simple (shelf packer) dans `packages/engine/src/assets/atlas-builder.ts` et tests unitaires.

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

Prochaines actions proposées

1. Créer milestone "Phase 2" et assigner les issues créées
2. Ouvrir PR `feature/phase2-start` -> `develop` contenant documentation (PHASE2_ROADMAP, docs/texture-system, ADR) et prototype `TextureManager` pour revue
3. Après PR merge: découper tâches secondaires et assigner tickets enfants (atlas, UV utils, shadow mapping, collision mesh gen)

---

Fichier généré automatiquement lors du démarrage Phase 2 — gardez-le à jour.
