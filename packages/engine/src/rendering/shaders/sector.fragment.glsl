#version 300 es
// DOOM-style Sector Fragment Shader (WebGL2)
precision highp float;

// Inputs from vertex shader
in vec3 worldPosition;
in vec3 worldNormal;
in vec2 texCoord;
in float vertexLightLevel;
in float fogFactor;

// Scene uniforms
uniform vec3 cameraPosition;
uniform float time;
uniform vec3 fogColor;

// Material uniforms
uniform vec4 baseColor;
uniform vec3 emissiveColor;
uniform float metallic;
uniform float roughness;
uniform vec2 materialTextureScale;
uniform float animationSpeed;

// Textures
uniform sampler2D baseTexture;

// Output
out vec4 fragColor;

// DOOM-style color palettes (simplified)
const int DOOM_PALETTE_SIZE = 8;
const vec3 DOOM_LIGHT_LEVELS[DOOM_PALETTE_SIZE] = vec3[](
    vec3(0.0, 0.0, 0.0),        // 0 - Pitch black
    vec3(0.125, 0.125, 0.125),  // 1 - Very dark
    vec3(0.25, 0.25, 0.25),     // 2 - Dark
    vec3(0.375, 0.375, 0.375),  // 3 - Dim
    vec3(0.5, 0.5, 0.5),        // 4 - Medium
    vec3(0.625, 0.625, 0.625),  // 5 - Bright
    vec3(0.75, 0.75, 0.75),     // 6 - Very bright
    vec3(1.0, 1.0, 1.0)         // 7 - Full bright
);

vec3 getDoomLightLevel(float lightLevel) {
    float scaledLevel = lightLevel * float(DOOM_PALETTE_SIZE - 1);
    int index = int(floor(scaledLevel));
    float fraction = fract(scaledLevel);
    
    if (index >= DOOM_PALETTE_SIZE - 1) {
        return DOOM_LIGHT_LEVELS[DOOM_PALETTE_SIZE - 1];
    }
    
    // Linear interpolation between light levels
    return mix(DOOM_LIGHT_LEVELS[index], DOOM_LIGHT_LEVELS[index + 1], fraction);
}

vec3 applyDoomColormap(vec3 color, float lightLevel) {
    // DOOM's colormap system - darker colors become more monochromatic
    vec3 doomLight = getDoomLightLevel(lightLevel);
    
    // Apply DOOM-style color reduction in dark areas
    float luminance = dot(color, vec3(0.299, 0.587, 0.114));
    vec3 desaturated = mix(vec3(luminance), color, lightLevel);
    
    return desaturated * doomLight;
}

void main() {
    // Sample base texture with animation support
    vec2 animatedUV = texCoord;
    
    // Simple texture animation (scrolling)
    if (animationSpeed > 0.0) {
        animatedUV.x += time * animationSpeed;
        animatedUV = fract(animatedUV); // Wrap UVs
    }
    
    vec4 baseTexColor = texture(baseTexture, animatedUV);
    
    // Early discard for full transparency
    if (baseTexColor.a < 0.1) {
        discard;
    }
    
    // Apply material base color tinting
    vec3 finalColor = baseTexColor.rgb * baseColor.rgb;
    
    // DOOM-style lighting application
    finalColor = applyDoomColormap(finalColor, vertexLightLevel);
    
    // Add emissive contribution (for self-illuminated surfaces)
    finalColor += emissiveColor;
    
    // Apply fog (DOOM's depth cueing)
    finalColor = mix(finalColor, fogColor, fogFactor);
    
    // Ensure we don't exceed color bounds
    finalColor = clamp(finalColor, vec3(0.0), vec3(1.0));
    
    fragColor = vec4(finalColor, baseTexColor.a * baseColor.a);
}