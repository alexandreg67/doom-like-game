#version 300 es
// DOOM-style Sector Vertex Shader (WebGL2)
precision highp float;

// Vertex attributes
in vec3 position;
in vec3 normal;
in vec2 uv;
in float lightLevel;

// Scene uniforms
uniform mat4 viewProjectionMatrix;
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform float time;

// DOOM-style lighting uniforms
uniform float globalLightLevel;
uniform vec3 ambientColor;
uniform vec3 fogColor;
uniform float fogDensity;

// Sector-specific uniforms
uniform float sectorLightLevel;
uniform float sectorFloorHeight;
uniform float sectorCeilingHeight;

// Model uniforms
uniform mat4 modelMatrix;
uniform mat4 normalMatrix;
uniform float sectorId;
uniform float surfaceType; // 0=floor, 1=ceiling, 2=wall
uniform vec2 textureScale;

// Outputs to fragment shader
out vec3 worldPosition;
out vec3 worldNormal;
out vec2 texCoord;
out float vertexLightLevel;
out float fogFactor;

void main() {
    // Transform vertex position
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    worldPosition = worldPos.xyz;
    gl_Position = viewProjectionMatrix * worldPos;
    
    // Transform normal
    worldNormal = normalize((normalMatrix * vec4(normal, 0.0)).xyz);
    
    // Calculate UV coordinates with DOOM-style texture scaling
    texCoord = uv * textureScale;
    
    // DOOM-style lighting calculation
    // Combine vertex light level with sector lighting
    float combinedLightLevel = lightLevel * sectorLightLevel * globalLightLevel;
    vertexLightLevel = clamp(combinedLightLevel, 0.0, 1.0);
    
    // Calculate fog factor for distance-based depth cueing (DOOM-style)
    float distanceToCamera = length(worldPosition - cameraPosition);
    fogFactor = 1.0 - exp(-fogDensity * distanceToCamera * distanceToCamera);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
}