# 🎮 DOOM-Like Game

> Modern web-based FPS game inspired by DOOM (1993), built with Babylon.js and cutting-edge web technologies.

[![CI](https://github.com/user/doom-like-game/workflows/CI/badge.svg)](https://github.com/user/doom-like-game/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Babylon.js](https://img.shields.io/badge/Babylon.js-7.0+-orange.svg)](https://www.babylonjs.com/)
[![WebGPU](https://img.shields.io/badge/WebGPU-Enabled-green.svg)](https://gpuweb.github.io/gpuweb/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## ✨ Features

- **🚀 Modern Performance**: WebGPU rendering with WebGL2 fallback
- **⚡ 60 FPS Gameplay**: Optimized for smooth retro action
- **🎯 DOOM-Inspired**: Classic sector-based rendering and gameplay
- **🎮 Full Controller Support**: Keyboard, mouse, and gamepad input
- **🔧 Built-in Editor**: Web-based level editor included
- **📱 Cross-Platform**: Runs on desktop and mobile browsers
- **🎵 3D Audio**: Immersive spatial sound system

## � Phase 2 — Améliorations prévues

La Phase 2 vise à enrichir l'expérience visuelle et technique du moteur : textures, éclairage dynamique, collisions, audio 3D et outils. Voir `PHASE2_ROADMAP.md` pour la feuille de route détaillée et `docs/texture-system.md` pour la spécification du système de textures.

## �🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (recommended) or npm
- **Modern browser** with WebGL2 support

### Installation

```bash
# Clone the repository
git clone https://github.com/user/doom-like-game.git
cd doom-like-game

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### First Build

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## 🏗️ Architecture

This project uses a **monorepo architecture** with multiple packages:

```
packages/
├── engine/          # 3D rendering engine (Babylon.js)
├── game-logic/      # ECS system and gameplay
├── map-editor/      # Level editor components
└── assets/          # Asset pipeline and WAD-like format

apps/
├── web/             # Main web application
└── docs/            # Documentation site

tools/               # Build scripts and utilities
```

## 🎮 Controls

| Action        | Keyboard | Mouse      | Gamepad          |
| ------------- | -------- | ---------- | ---------------- |
| Move Forward  | W        | -          | Left Stick Up    |
| Move Backward | S        | -          | Left Stick Down  |
| Strafe Left   | A        | -          | Left Stick Left  |
| Strafe Right  | D        | -          | Left Stick Right |
| Look Around   | -        | Move       | Right Stick      |
| Fire          | Space    | Left Click | Right Trigger    |
| Open Doors    | E        | -          | A Button         |
| Menu          | Esc      | -          | Start Button     |

## 🛠️ Development

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build all packages
pnpm clean            # Clean build artifacts

# Testing
pnpm test             # Run unit tests
pnpm test:ui          # Run tests with UI
pnpm test:e2e         # Run E2E tests
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # Lint all packages
pnpm format           # Format code with Biome
pnpm typecheck        # TypeScript type checking
```

### Adding New Features

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes following our [coding standards](CONTRIBUTING.md)
3. Add tests for new functionality
4. Run the full test suite: `pnpm test`
5. Submit a pull request

## 🎨 Level Editor

The built-in level editor allows you to create custom maps:

1. Open the editor at `/editor`
2. Use the drawing tools to create sectors
3. Place enemies, items, and spawn points
4. Export your level as a WAD-like file
5. Load it in the game

See the [Level Editor Guide](docs/level-editor.md) for detailed instructions.

## 🚀 Deployment

### Production Build

```bash
# Build for production
pnpm build

# The built files will be in apps/web/dist/
```

### Hosting Requirements

- **HTTPS required** for WebGPU support
- **COOP/COEP headers** for SharedArrayBuffer (performance)
- **CDN recommended** for assets and static files

Example server configuration:

```nginx
# nginx.conf
add_header Cross-Origin-Opener-Policy same-origin;
add_header Cross-Origin-Embedder-Policy require-corp;
add_header Content-Security-Policy "script-src 'self' 'wasm-unsafe-eval'";
```

## 🌐 Browser Support

| Browser | Version | WebGPU | WebGL2 | Status       |
| ------- | ------- | ------ | ------ | ------------ |
| Chrome  | 94+     | ✅     | ✅     | Full Support |
| Firefox | 85+     | 🚧     | ✅     | WebGL2 Only  |
| Safari  | 14+     | 🚧     | ✅     | WebGL2 Only  |
| Edge    | 94+     | ✅     | ✅     | Full Support |

## 📊 Performance

### Target Specifications

- **Frame Rate**: 60 FPS stable
- **Load Time**: < 3 seconds on broadband
- **Memory Usage**: < 512 MB peak
- **Bundle Size**: < 10 MB initial load

### Optimization Features

- **Level-of-Detail (LOD)** system for distant objects
- **Frustum Culling** via BSP trees
- **Texture Atlasing** for reduced draw calls
- **Asset Streaming** for large levels

## 🔧 Configuration

### Environment Variables

```env
# .env.local
VITE_WEBGPU_ENABLED=true
VITE_DEBUG_MODE=false
VITE_TELEMETRY_ENDPOINT=https://analytics.example.com
```

### Game Settings

Game settings are stored in localStorage and include:

- Graphics quality (Low/Medium/High)
- Audio volume and 3D audio toggle
- Control remapping
- Accessibility options

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Areas for Contribution

- 🎮 **Gameplay**: New weapons, enemies, power-ups
- 🎨 **Graphics**: Shaders, visual effects, UI improvements
- 🎵 **Audio**: Sound effects, music, 3D audio enhancements
- 🗺️ **Maps**: Level design and editor improvements
- 🧪 **Testing**: Browser compatibility and performance
- 📖 **Documentation**: Guides, tutorials, API docs

## 📜 Legal

This project is **inspired by DOOM** but contains **no copyrighted assets** from id Software. All graphics, sounds, and maps are original creations or open-source resources.

### What We Use

- ✅ Game mechanics (public domain)
- ✅ Technical concepts (BSP, WAD format structure)
- ✅ Original assets and levels

### What We Don't Use

- ❌ Original DOOM assets (sprites, textures, sounds)
- ❌ Original level data or maps
- ❌ Copyrighted music or sound effects

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **id Software** for creating DOOM and inspiring this project
- **Babylon.js Team** for the excellent 3D engine
- **WebGPU Working Group** for advancing web graphics
- **Open Source Community** for tools and libraries

---

**🎯 Ready to rip and tear through some demons? Let's build the ultimate web FPS together!**
