# Contributing to DOOM-Like Game

Thank you for your interest in contributing! This guide will help you get started with contributing to our modern web FPS project.

## 🎯 Project Vision

We're building a modern web-based FPS that captures the essence of DOOM while showcasing cutting-edge web technologies. Our focus is on:

- **Performance**: 60 FPS gameplay on mid-range hardware
- **Innovation**: WebGPU, modern ES2022+ JavaScript, advanced web APIs  
- **Accessibility**: Cross-platform, controller support, customizable controls
- **Community**: Modding support, level editor, open development

## 🚀 Getting Started

### Development Setup

1. **Fork and Clone**
   ```bash
   git fork https://github.com/user/doom-like-game.git
   cd doom-like-game
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Setup Git Hooks**
   ```bash
   pnpm lefthook install
   ```

4. **Verify Setup**
   ```bash
   pnpm typecheck
   pnpm test
   pnpm dev
   ```

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/awesome-feature
   ```

2. **Make Changes**
   - Follow our coding standards (see below)
   - Write/update tests
   - Update documentation

3. **Test Your Changes**
   ```bash
   pnpm test
   pnpm test:e2e
   pnpm lint
   pnpm typecheck
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat(engine): add awesome feature"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/awesome-feature
   ```

## 📋 Coding Standards

### TypeScript

- **Strict Mode**: All code must pass TypeScript strict checks
- **No `any`**: Use proper typing, `unknown` for truly dynamic content
- **Consistent Naming**: `camelCase` for variables, `PascalCase` for classes
- **Interface Segregation**: Small, focused interfaces over large ones

```typescript
// ✅ Good
interface PlayerMovement {
  position: Vector3;
  velocity: Vector3;
  acceleration: number;
}

// ❌ Bad
interface Player {
  // 50+ properties mixing concerns
}
```

### Code Organization

- **Single Responsibility**: Each file/class has one clear purpose
- **Dependency Injection**: Avoid singletons, inject dependencies
- **Pure Functions**: Prefer pure functions for business logic
- **Minimal Mutations**: Use immutable patterns where possible

```typescript
// ✅ Good: Pure function
function calculateDamage(weapon: Weapon, distance: number): number {
  return weapon.baseDamage * weapon.damageMultiplier(distance);
}

// ❌ Bad: Mutating global state
function fireBullet() {
  globalGameState.ammo--; // Side effect
  // ...
}
```

### Performance Guidelines

- **60 FPS Target**: All code must maintain 60 FPS on mid-range hardware
- **Memory Management**: Dispose resources, avoid memory leaks
- **Bundle Size**: Keep package size minimal, use code splitting
- **GPU Optimization**: Minimize draw calls, use instancing

```typescript
// ✅ Good: Object pooling
class BulletPool {
  private pool: Bullet[] = [];
  
  get(): Bullet {
    return this.pool.pop() ?? new Bullet();
  }
  
  release(bullet: Bullet): void {
    bullet.reset();
    this.pool.push(bullet);
  }
}

// ❌ Bad: Creating objects every frame
function update() {
  const bullet = new Bullet(); // GC pressure
}
```

## 🧪 Testing Standards

### Unit Tests

- **Coverage**: Maintain >70% coverage
- **Fast**: Tests should run in <1s total
- **Isolated**: No dependencies between tests
- **Descriptive**: Clear test names and descriptions

```typescript
describe('WeaponSystem', () => {
  it('should calculate correct damage at close range', () => {
    const weapon = new Shotgun();
    const damage = weapon.calculateDamage(1.0); // 1 meter
    
    expect(damage).toBeCloseTo(100);
  });
});
```

### E2E Tests

- **Critical Paths**: Test main user journeys
- **Cross-Browser**: Test Chrome, Firefox, Safari
- **Performance**: Include frame rate and load time tests
- **Visual**: Screenshot tests for UI components

```typescript
test('player can complete level 1', async ({ page }) => {
  await page.goto('/');
  await page.click('#start-game');
  
  // Test gameplay mechanics
  await page.keyboard.press('KeyW'); // Move forward
  await page.mouse.click(640, 360);  // Fire weapon
  
  // Assert level completion
  await expect(page.locator('#level-complete')).toBeVisible();
});
```

## 🎨 Areas for Contribution

### 🎮 Gameplay Features

**Difficulty**: Beginner to Advanced

- **Weapons**: New weapon types, projectile physics
- **Enemies**: AI behaviors, pathfinding improvements  
- **Power-ups**: Health packs, armor, temporary abilities
- **Environmental**: Interactive objects, destructible elements

**Getting Started**:
1. Check existing weapon system in `packages/game-logic/src/weapons/`
2. Study the ECS architecture in `packages/game-logic/src/ecs/`
3. Look at enemy AI in `packages/game-logic/src/ai/`

### 🎨 Graphics & Rendering

**Difficulty**: Intermediate to Advanced

- **Shaders**: Custom WGSL shaders for WebGPU
- **Effects**: Particle systems, lighting improvements
- **UI**: Game menus, HUD components, accessibility
- **Optimization**: LOD systems, culling improvements

**Getting Started**:
1. Explore `packages/engine/src/rendering/`
2. Check Babylon.js documentation for custom shaders
3. Study WebGPU examples for advanced rendering

### 🎵 Audio System

**Difficulty**: Beginner to Intermediate

- **3D Audio**: Spatial sound improvements
- **Music**: Dynamic music system based on gameplay
- **Sound Effects**: Weapon sounds, ambient audio
- **Performance**: Audio streaming and compression

**Getting Started**:
1. Look at Web Audio API usage in `packages/engine/src/audio/`
2. Study 3D audio positioning algorithms
3. Test audio on different devices

### 🗺️ Level Design & Editor

**Difficulty**: Beginner to Intermediate

- **Editor UI**: Drag & drop improvements, undo/redo
- **Map Features**: New sector types, scripting system
- **Export/Import**: WAD format improvements
- **Templates**: Pre-built level templates

**Getting Started**:
1. Try the level editor at `/editor`
2. Study the WAD-like format in `packages/assets/`
3. Look at the 2D drawing tools in `packages/map-editor/`

### 🔧 Developer Tools

**Difficulty**: Intermediate

- **Debugging**: In-game console, performance profiler
- **Build Tools**: Bundle optimization, asset pipeline
- **Testing**: More browser coverage, automated performance tests
- **CI/CD**: Deployment improvements, security scanning

**Getting Started**:
1. Check `.github/workflows/` for CI setup
2. Study the build configuration in `vite.config.ts`
3. Look at testing setup in `playwright.config.ts`

## 📝 Documentation

We value clear documentation as much as good code!

### What to Document

- **New Features**: Add examples and usage guide
- **API Changes**: Update TypeScript interfaces and examples
- **Performance**: Document any performance implications
- **Breaking Changes**: Clear migration guide

### Documentation Types

- **README**: Project overview and quick start
- **CLAUDE.md**: Technical documentation for AI assistants
- **API Docs**: Generated from TypeScript interfaces
- **Tutorials**: Step-by-step guides for complex features

## 🎯 Contribution Guidelines

### Pull Request Process

1. **Link Issues**: Reference related issues in PR description
2. **Clear Description**: Explain what, why, and how
3. **Testing**: Include tests for new functionality
4. **Documentation**: Update relevant documentation
5. **Performance**: Ensure no performance regressions

### PR Template Checklist

- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Performance impact assessed
- [ ] Browser compatibility tested
- [ ] TypeScript compilation successful
- [ ] Accessibility considerations addressed

### Code Review Process

- **Required Reviewers**: 1 core maintainer approval needed
- **Automated Checks**: All CI checks must pass
- **Performance Review**: Frame rate impact assessed
- **Security Review**: Potential vulnerabilities checked

## 🎮 Game Design Principles

When contributing gameplay features, keep these principles in mind:

### Core Gameplay

- **Responsive Controls**: Input latency < 50ms
- **Clear Feedback**: Visual/audio confirmation of all actions
- **Progressive Difficulty**: Smooth learning curve
- **Player Agency**: Multiple ways to solve problems

### Technical Excellence

- **60 FPS First**: Performance over visual fidelity
- **Accessibility**: Support for different abilities
- **Modding Friendly**: Extensible architecture
- **Cross-Platform**: Works on desktop and mobile

## 🚫 What We Don't Accept

- **Copyrighted Content**: No DOOM assets or other copyrighted material
- **Performance Regressions**: Code that drops below 60 FPS
- **Breaking Changes**: Without proper migration guide
- **Unsafe Code**: Potential security vulnerabilities
- **Poor Documentation**: Code without adequate explanation

## 🤝 Community Guidelines

- **Be Respectful**: Treat all contributors with kindness
- **Be Patient**: We're all learning and growing together
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Inclusive**: Welcome contributors of all backgrounds and skill levels

## 🆘 Getting Help

### Documentation

- **CLAUDE.md**: Comprehensive technical documentation
- **README.md**: Quick start and overview
- **GitHub Issues**: Search existing issues first
- **Discussions**: Ask questions in GitHub Discussions

### Contacting Maintainers

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and community chat
- **Email**: [maintainer@example.com](mailto:maintainer@example.com) for security issues

## 🏆 Recognition

Contributors are recognized through:

- **Contributors Page**: Listed in README and documentation
- **Release Notes**: Major contributions highlighted
- **GitHub Profile**: Contribution graph and achievements
- **Community Shout-outs**: Social media recognition for significant contributions

---

**Thank you for contributing to the future of web gaming! 🎮🚀**