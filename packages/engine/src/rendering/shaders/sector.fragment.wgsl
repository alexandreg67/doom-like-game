// DOOM-style Sector Fragment Shader (WebGPU)
// Implements DOOM's distinctive lighting and texture rendering

struct FragmentInput {
    @builtin(position) clipPosition: vec4<f32>,
    @location(0) worldPosition: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) lightLevel: f32,
    @location(4) fogFactor: f32,
}

struct SceneUniforms {
    viewProjectionMatrix: mat4x4<f32>,
    viewMatrix: mat4x4<f32>,
    cameraPosition: vec3<f32>,
    time: f32,
    
    // DOOM-style lighting
    globalLightLevel: f32,
    ambientColor: vec3<f32>,
    fogColor: vec3<f32>,
    fogDensity: f32,
    
    // Sector-specific
    sectorLightLevel: f32,
    sectorFloorHeight: f32,
    sectorCeilingHeight: f32,
    _padding: f32, // Align to 16 bytes
}

struct MaterialUniforms {
    baseColor: vec4<f32>,
    emissiveColor: vec3<f32>,
    metallic: f32,
    roughness: f32,
    textureScale: vec2<f32>,
    animationSpeed: f32,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(2) @binding(0) var<uniform> material: MaterialUniforms;
@group(2) @binding(1) var textureSampler: sampler;
@group(2) @binding(2) var baseTexture: texture_2d<f32>;

// DOOM-style color palettes (simplified)
const DOOM_PALETTE_SIZE = 8u;
const DOOM_LIGHT_LEVELS = array<vec3<f32>, DOOM_PALETTE_SIZE>(
    vec3<f32>(0.0, 0.0, 0.0),      // 0 - Pitch black
    vec3<f32>(0.125, 0.125, 0.125), // 1 - Very dark
    vec3<f32>(0.25, 0.25, 0.25),    // 2 - Dark
    vec3<f32>(0.375, 0.375, 0.375), // 3 - Dim
    vec3<f32>(0.5, 0.5, 0.5),       // 4 - Medium
    vec3<f32>(0.625, 0.625, 0.625), // 5 - Bright
    vec3<f32>(0.75, 0.75, 0.75),    // 6 - Very bright
    vec3<f32>(1.0, 1.0, 1.0),       // 7 - Full bright
);

fn getDoomLightLevel(lightLevel: f32) -> vec3<f32> {
    let scaledLevel = lightLevel * f32(DOOM_PALETTE_SIZE - 1u);
    let index = u32(floor(scaledLevel));
    let fraction = fract(scaledLevel);
    
    if (index >= DOOM_PALETTE_SIZE - 1u) {
        return DOOM_LIGHT_LEVELS[DOOM_PALETTE_SIZE - 1u];
    }
    
    // Linear interpolation between light levels
    return mix(DOOM_LIGHT_LEVELS[index], DOOM_LIGHT_LEVELS[index + 1u], fraction);
}

fn applyDoomColormap(color: vec3<f32>, lightLevel: f32) -> vec3<f32> {
    // DOOM's colormap system - darker colors become more monochromatic
    let doomLight = getDoomLightLevel(lightLevel);
    
    // Apply DOOM-style color reduction in dark areas
    let luminance = dot(color, vec3<f32>(0.299, 0.587, 0.114));
    let desaturated = mix(vec3<f32>(luminance), color, lightLevel);
    
    return desaturated * doomLight;
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    // Sample base texture with animation support
    var animatedUV = input.uv;
    
    // Simple texture animation (scrolling)
    if (material.animationSpeed > 0.0) {
        animatedUV.x += scene.time * material.animationSpeed;
        animatedUV = fract(animatedUV); // Wrap UVs
    }
    
    let baseColor = textureSample(baseTexture, textureSampler, animatedUV);
    
    // Early discard for full transparency
    if (baseColor.a < 0.1) {
        discard;
    }
    
    // Apply material base color tinting
    var finalColor = baseColor.rgb * material.baseColor.rgb;
    
    // DOOM-style lighting application
    finalColor = applyDoomColormap(finalColor, input.lightLevel);
    
    // Add emissive contribution (for self-illuminated surfaces)
    finalColor += material.emissiveColor;
    
    // Apply fog (DOOM's depth cueing)
    finalColor = mix(finalColor, scene.fogColor, input.fogFactor);
    
    // Ensure we don't exceed color bounds
    finalColor = clamp(finalColor, vec3<f32>(0.0), vec3<f32>(1.0));
    
    return vec4<f32>(finalColor, baseColor.a * material.baseColor.a);
}