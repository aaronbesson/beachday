import * as THREE from 'three';
import { createGrass, updateGrass } from './modules/createGrass.js';

// Create a grass texture at runtime
function createGrassTexture() {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Clear with transparent background
    ctx.clearRect(0, 0, size, size);
    
    // Draw grass blade
    const drawBlade = (x, w, h, curve) => {
        ctx.beginPath();
        ctx.moveTo(x, size);
        ctx.quadraticCurveTo(x + curve, size - h/2, x + w/2, size - h);
        ctx.quadraticCurveTo(x + w - curve, size - h/2, x + w, size);
        ctx.closePath();
        
        // Fill with gradient
        const gradient = ctx.createLinearGradient(0, size - h, 0, size);
        gradient.addColorStop(0, 'rgba(120, 200, 80, 0.8)'); // Lighter at top
        gradient.addColorStop(1, 'rgba(60, 130, 40, 0.9)');  // Darker at bottom
        ctx.fillStyle = gradient;
        ctx.fill();
    };
    
    // Draw several blades with variations
    drawBlade(45, 30, 110, 15);
    drawBlade(30, 25, 100, -10);
    drawBlade(60, 35, 115, 5);
    drawBlade(20, 20, 90, 0);
    drawBlade(70, 28, 105, -8);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBAFormat;
    
    return texture;
}

// Create noise texture for animation and color variation
function createNoiseTexture(size = 256) {
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size * 4; i += 4) {
        const val = Math.floor(Math.random() * 255);
        data[i] = val;     // r
        data[i+1] = val;   // g
        data[i+2] = val;   // b
        data[i+3] = 255;   // a
    }
    
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    
    return texture;
}

// Vertex shader for grass animation and positioning
const grassVertexShader = `
    uniform float time;
    uniform sampler2D noiseTexture;
    uniform float noiseScale;
    
    attribute float size;
    attribute float angle;
    attribute vec3 offset;
    attribute float lodLevel;
    
    varying vec2 vUv;
    varying float vLodLevel;
    varying float vHeight;
    
    void main() {
        vUv = uv;
        vLodLevel = lodLevel;
        
        // Calculate the position of this grass instance
        vec3 pos = position;
        
        // Apply rotation for the billboard
        float s = sin(angle);
        float c = cos(angle);
        mat3 rotMat = mat3(
            c, 0, s,
            0, 1, 0,
            -s, 0, c
        );
        
        // Calculate the final position
        pos = rotMat * pos;
        
        // Apply offset for instancing
        pos += offset;
        vHeight = offset.y;
        
        // Sample noise for wind animation
        vec2 noiseCoord = vec2(pos.x * noiseScale + time * 0.05, pos.z * noiseScale + time * 0.07);
        float noise = texture2D(noiseTexture, noiseCoord).r;
        
        // Apply wind effect (stronger at the top of the grass)
        float windStrength = 0.2;
        float heightFactor = smoothstep(0.0, 1.0, pos.y / size);
        
        // Apply sine wave animation for wind
        float windAngle = time * 1.5 + noise * 2.0 * 3.14159;
        vec2 windDir = vec2(sin(windAngle), cos(windAngle)) * windStrength * heightFactor;
        
        // Apply the wind displacement
        pos.xz += windDir * heightFactor;
        
        // Calculate the final position
        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Fragment shader for grass coloring and alpha cutout
const grassFragmentShader = `
    uniform sampler2D grassTexture;
    uniform vec3 baseColor;
    uniform vec3 tipColor;
    uniform vec3 tipColor2;
    uniform sampler2D noiseTexture;
    uniform float noiseScale;
    uniform float time;
    
    varying vec2 vUv;
    varying float vLodLevel;
    varying float vHeight;
    
    void main() {
        // Sample the grass texture
        vec4 texColor = texture2D(grassTexture, vUv);
        
        // Discard transparent pixels
        if (texColor.a < 0.5) discard;
        
        // Sample noise for color variation
        vec2 noiseCoord = vec2(vHeight * 0.01 + time * 0.01, vHeight * 0.01 + time * 0.015);
        float noise = texture2D(noiseTexture, noiseCoord).r;
        
        // Mix between base color and tip colors based on height
        vec3 finalTipColor = mix(tipColor, tipColor2, noise);
        vec3 color = mix(baseColor, finalTipColor, vUv.y);
        
        // Apply slight darkness at bottom for fake ambient occlusion
        float ao = mix(0.7, 1.0, smoothstep(0.0, 0.3, vUv.y));
        
        // Output final color
        gl_FragColor = vec4(color * ao * texColor.rgb, texColor.a);
    }
`;

// Create basic cross-shaped grass geometry
function createGrassGeometry(width, height, segments) {
    // Create two intersecting planes
    const planeGeo1 = new THREE.PlaneGeometry(width, height, 1, segments);
    const planeGeo2 = new THREE.PlaneGeometry(width, height, 1, segments);
    
    // Rotate second plane 90 degrees
    const plane2Matrix = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    planeGeo2.applyMatrix4(plane2Matrix);
    
    // Combine geometries (simpler approach without merging)
    const group = new THREE.Group();
    const plane1 = new THREE.Mesh(planeGeo1, new THREE.MeshBasicMaterial());
    const plane2 = new THREE.Mesh(planeGeo2, new THREE.MeshBasicMaterial());
    group.add(plane1, plane2);
    
    // Return first geometry for now (will be enhanced later)
    return planeGeo1;
}

export function createGrass(scene, TERRAIN_SIZE, TERRAIN_SEGMENTS, getTerrainHeight) {
    console.log("Creating grass system...");
    
    // Check if getTerrainHeight is a function
    if (typeof getTerrainHeight !== 'function') {
        console.error("Invalid terrain height function provided to createGrass");
        return [];
    }
    
    // Configure grass parameters (reduced for troubleshooting)
    const GRASS_CHUNKS = 4; // Start with fewer chunks (4x4 grid)
    const GRASS_PER_CHUNK = 100; // Fewer instances per chunk
    const CHUNK_SIZE = TERRAIN_SIZE / GRASS_CHUNKS;
    const WATER_LEVEL = 8; // Hardcoded for now
    
    // Create simple grass material without textures for now
    const grassMaterial = new THREE.MeshBasicMaterial({
        color: 0x3a9b52,
        side: THREE.DoubleSide
    });
    
    // Store all grass chunks
    const grassChunks = [];
    
    // Create chunks
    for (let x = 0; x < GRASS_CHUNKS; x++) {
        for (let z = 0; z < GRASS_CHUNKS; z++) {
            // Calculate chunk position
            const chunkX = (x / GRASS_CHUNKS - 0.5) * TERRAIN_SIZE;
            const chunkZ = (z / GRASS_CHUNKS - 0.5) * TERRAIN_SIZE;
            
            // Create LOD levels for this chunk
            const lod = new THREE.LOD();
            lod.position.set(chunkX, 0, chunkZ);
            
            // Create instanced meshes for each LOD level
            const highDetailMesh = new THREE.InstancedMesh(createGrassGeometry(1.5, 3, 8), grassMaterial, GRASS_PER_CHUNK);
            const medDetailMesh = new THREE.InstancedMesh(createGrassGeometry(1.5, 3, 4), grassMaterial, GRASS_PER_CHUNK);
            const lowDetailMesh = new THREE.InstancedMesh(createGrassGeometry(1.5, 3, 2), grassMaterial, GRASS_PER_CHUNK);
            
            // Set up transforms for grass instances
            const dummy = new THREE.Object3D();
            const positions = [];
            
            // Place grass within chunk bounds
            for (let i = 0; i < GRASS_PER_CHUNK; i++) {
                // Random position within chunk
                const offsetX = (Math.random() - 0.5) * CHUNK_SIZE;
                const offsetZ = (Math.random() - 0.5) * CHUNK_SIZE;
                
                const worldX = chunkX + offsetX;
                const worldZ = chunkZ + offsetZ;
                
                // Get height at this position
                const terrainHeight = getTerrainHeight(worldX, worldZ);
                
                // Only place grass above water level
                if (terrainHeight > WATER_LEVEL + 1) {
                    // Save position for animation
                    positions.push({
                        x: worldX,
                        y: terrainHeight, 
                        z: worldZ,
                        scale: 0.8 + Math.random() * 0.4,
                        angle: Math.random() * Math.PI
                    });
                    
                    // Set transform
                    dummy.position.set(offsetX, terrainHeight - lod.position.y, offsetZ);
                    dummy.rotation.y = Math.random() * Math.PI * 2;
                    dummy.scale.set(
                        0.8 + Math.random() * 0.4,
                        0.7 + Math.random() * 0.6,
                        0.8 + Math.random() * 0.4
                    );
                    dummy.updateMatrix();
                    
                    // Apply to all LOD levels
                    highDetailMesh.setMatrixAt(i, dummy.matrix);
                    medDetailMesh.setMatrixAt(i, dummy.matrix);
                    lowDetailMesh.setMatrixAt(i, dummy.matrix);
                }
            }
            
            // Add LOD levels
            lod.addLevel(highDetailMesh, 100);
            lod.addLevel(medDetailMesh, 200);
            lod.addLevel(lowDetailMesh, 300);
            
            // Store positions for wind animation
            lod.userData = { positions: positions };
            
            // Only add chunk if it has grass in it
            if (positions.length > 0) {
                scene.add(lod);
                grassChunks.push(lod);
            }
        }
    }
    
    return grassChunks;
}

// Wind animation function
export function updateGrass(grassChunks, time) {
    if (!grassChunks) return;
    
    const windStrength = 0.15;
    const windFrequency = 0.5;
    
    grassChunks.forEach(chunk => {
        // Get the active LOD level mesh
        const activeLOD = chunk.getObjectForDistance(chunk._currentDistance);
        if (!activeLOD) return;
        
        const positions = chunk.userData.positions;
        const dummy = new THREE.Object3D();
        
        // Update each grass instance
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            
            // Wind calculation
            const windEffect = 
                Math.sin(time * windFrequency + pos.x * 0.1) * 
                Math.cos(time * windFrequency * 0.7 + pos.z * 0.1) * 
                windStrength;
            
            // Apply wind
            dummy.position.set(
                pos.x - chunk.position.x, 
                pos.y - chunk.position.y, 
                pos.z - chunk.position.z
            );
            dummy.rotation.set(
                windEffect * 0.2, // Tilt in wind direction
                pos.angle,        // Random base rotation
                windEffect * 0.1  // Slight twist
            );
            dummy.scale.set(pos.scale, pos.scale, pos.scale);
            dummy.updateMatrix();
            
            // Apply to instanced mesh
            activeLOD.setMatrixAt(i, dummy.matrix);
        }
        
        // Update the instance matrices
        activeLOD.instanceMatrix.needsUpdate = true;
    });
}

// Assuming terrain.geometry, TERRAIN_SIZE, WATER_LEVEL are defined
const getTerrainHeight = (x, z) => {
    // Use your existing terrain height function here
    // This would be the same function used in your shark code
};

const grassChunks = createGrass(scene, TERRAIN_SIZE, TERRAIN_SEGMENTS, getTerrainHeight); 

function animate(time) {
    // Your existing animation code
    
    // Update grass with wind animation
    updateGrass(grassChunks, time * 0.001);
    
    // Continue with rendering
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
} 