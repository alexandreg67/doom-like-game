# Pull Request

## 📝 Description

Brief description of what this PR does.

## 🎯 Type of Change

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation (documentation only changes)
- [ ] 🎨 Style (formatting, missing semi colons, etc; no code change)
- [ ] ♻️ Refactor (refactoring production code)
- [ ] ⚡ Performance (A code change that improves performance)
- [ ] ✅ Test (adding missing tests, refactoring tests; no production code change)
- [ ] 🔧 Build (changes to build process or auxiliary tools)

## 🎮 Areas Affected

- [ ] Engine (rendering, WebGPU/WebGL)
- [ ] Game Logic (ECS, physics, AI)
- [ ] Map Editor (2D tools, export)
- [ ] Assets (WAD-like, pipeline)
- [ ] Web App (UI, integration)
- [ ] CI/CD (workflows, tests)
- [ ] Documentation

## ✅ Checklist

- [ ] My code follows the project's style guidelines (Biome)
- [ ] I have performed a self-review of my own code
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published

## 🧪 Testing

### Unit Tests
- [ ] All existing tests pass
- [ ] New tests added for new functionality
- [ ] Coverage maintained above 70%

### E2E Tests
- [ ] Existing E2E tests pass
- [ ] New E2E tests added if needed
- [ ] Tested in Chrome, Firefox, Safari

### Performance Tests
- [ ] Frame rate maintained (60 FPS target)
- [ ] Memory usage checked (no leaks)
- [ ] Bundle size impact assessed

### Manual Testing
- [ ] WebGPU tested (Chrome with --enable-unsafe-webgpu)
- [ ] WebGL2 fallback tested
- [ ] Mobile browsers tested
- [ ] Gamepad support tested (if applicable)

## 🎯 Screenshots / GIFs

If UI changes, include before/after screenshots or GIFs demonstrating the changes.

## 🔗 Related Issues

Closes #(issue_number)
Relates to #(issue_number)

## 🚀 Performance Impact

Describe any performance implications:
- Frame rate impact: N/A / Positive / Neutral / Negative
- Memory usage: N/A / Decreased / No change / Increased by X MB
- Bundle size: N/A / Decreased / No change / Increased by X KB

## 🎮 Gameplay Impact

If this affects gameplay:
- [ ] Maintains game balance
- [ ] Preserves existing controls
- [ ] No breaking changes to save format
- [ ] Backwards compatible with existing maps

## 🔒 Security Considerations

- [ ] No sensitive data exposed in logs
- [ ] CSP headers still valid
- [ ] No new XSS vulnerabilities
- [ ] Asset loading remains secure

## 📱 Browser Compatibility

Tested on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Chrome Mobile
- [ ] Safari Mobile

## 📋 Additional Notes

Any additional information, context, or considerations for reviewers.