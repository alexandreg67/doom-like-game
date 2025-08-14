# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Default branch changed from `feature/doom-sectors-basic` to `main`
- **CI/CD**: GitHub Actions workflows now properly trigger on PRs to `main`
- Updated `CONTRIBUTING.md` to reference `main` as the base branch for new features

### Fixed
- **CI/CD**: Fixed CI pipeline not triggering on pull requests due to incorrect default branch configuration

### Infrastructure
- Migrated repository default branch to `main` following GitHub best practices
- Ensured all existing workflows are compatible with new branch structure
- Added branch protection via lefthook to prevent direct pushes to `main`

## Migration Notes for Developers

### Updating Local Repositories

If you have an existing local clone, follow these steps to update:

```bash
# Fetch the latest branches
git fetch origin

# Switch to the new main branch
git checkout main

# Update your local main branch
git pull origin main

# Optional: Clean up old tracking branches
git remote prune origin
```

### New Development Workflow

- **Base Branch**: Create new feature branches from `main` instead of `develop`
- **Pull Requests**: Target `main` for all new PRs
- **CI/CD**: All workflows now properly trigger on PRs to `main`

---

## [0.1.0] - 2024-XX-XX

### Added
- Initial project structure with modern TypeScript monorepo setup
- WebGPU-based 3D rendering engine using Babylon.js
- Basic ECS (Entity Component System) architecture
- DOOM-style sector-based level geometry system
- Modern build pipeline with Vite and pnpm workspaces
- Comprehensive testing setup with Vitest and Playwright
- Level editor with 2D map creation capabilities
- Asset loading system for textures and audio
- Basic player movement and camera controls

### Technical
- **Engine**: Custom WebGPU renderer with fallback to WebGL
- **Architecture**: Modular package structure with clear separation of concerns
- **Testing**: Unit tests with Vitest, E2E tests with Playwright
- **CI/CD**: GitHub Actions with automated testing, building, and deployment
- **Code Quality**: ESLint, Prettier, and TypeScript strict mode
- **Performance**: Optimized for 60 FPS gameplay on mid-range hardware

### Packages
- `@doom-like/engine` - Core 3D engine and rendering
- `@doom-like/game-logic` - ECS and gameplay systems  
- `@doom-like/assets` - Asset loading and management
- `@doom-like/map-editor` - Level creation tools
- `@doom-like/web` - Main web application

---

*For more details about any release, check the [GitHub releases page](https://github.com/alexandreg67/doom-like-game/releases).*
