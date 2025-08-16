// DOOM-style Sector Vertex Shader (WebGPU)
// Handles sector geometry with height-based rendering and texture mapping

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) uv: vec2<f32>,
    @location(3) lightLevel: f32,
}

struct VertexOutput {
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

struct ModelUniforms {
    modelMatrix: mat4x4<f32>,
    normalMatrix: mat4x4<f32>,
    sectorId: f32,
    surfaceType: f32, // 0=floor, 1=ceiling, 2=wall
    textureScale: vec2<f32>,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> model: ModelUniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Transform vertex position
    let worldPosition = model.modelMatrix * vec4<f32>(input.position, 1.0);
    output.worldPosition = worldPosition.xyz;
    output.clipPosition = scene.viewProjectionMatrix * worldPosition;
    
    // Transform normal
    output.normal = normalize((model.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    
    // Calculate UV coordinates with DOOM-style texture scaling
    output.uv = input.uv * model.textureScale;
    
    // DOOM-style lighting calculation
    // Combine vertex light level with sector lighting
    let combinedLightLevel = input.lightLevel * scene.sectorLightLevel * scene.globalLightLevel;
    output.lightLevel = clamp(combinedLightLevel, 0.0, 1.0);
    
    // Calculate fog factor for distance-based depth cueing (DOOM-style)
    let distanceToCamera = length(output.worldPosition - scene.cameraPosition);
    output.fogFactor = 1.0 - exp(-scene.fogDensity * distanceToCamera * distanceToCamera);
    output.fogFactor = clamp(output.fogFactor, 0.0, 1.0);
    
    return output;
}