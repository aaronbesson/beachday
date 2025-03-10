import * as THREE from 'three';
import { SimplexNoise } from 'three/addons/math/SimplexNoise.js';

export function createTerrain(
    scene,
    TERRAIN_SIZE,
    TERRAIN_SEGMENTS,
    WATER_LEVEL
) {
    const geometry = new THREE.PlaneGeometry(
        TERRAIN_SIZE, 
        TERRAIN_SIZE, 
        TERRAIN_SEGMENTS, 
        TERRAIN_SEGMENTS
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Apply simplex noise to create heights with more detail layers
    const simplex = new SimplexNoise();
    const vertices = geometry.attributes.position.array;
    
    // Store height data for physics
    const heightData = [];
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        
        // Multiple noise layers for more interesting detailed terrain
        const noise1 = simplex.noise(x * 0.001, z * 0.001);
        // const noise2 = simplex.noise(x * 0.01, z * 0.01) * 0.3;
        // const noise3 = simplex.noise(x * 0.05, z * 0.05) * 0.1;
        // const noise4 = simplex.noise(x * 0.2, z * 0.2) * 0.05;
        // const noise5 = simplex.noise(x * 0.4, z * 0.4) * 0.025;
        
        let height = (noise1) * 140;
        
        // Smoother transition for underwater areas
        if (height < WATER_LEVEL + 2) {
            height = WATER_LEVEL - 2 + Math.random() * 1;
        }
        
        vertices[i + 1] = height;
        
        // Store height data for reference
        const xIndex = Math.floor((x + TERRAIN_SIZE/2) / (TERRAIN_SIZE/TERRAIN_SEGMENTS));
        const zIndex = Math.floor((z + TERRAIN_SIZE/2) / (TERRAIN_SIZE/TERRAIN_SEGMENTS));
        if (!heightData[zIndex]) heightData[zIndex] = [];
        heightData[zIndex][xIndex] = height;
    }
    
    // Compute normals for proper lighting
    geometry.computeVertexNormals();
    
    // Create terrain material
    const material = new THREE.MeshStandardMaterial({
        color: 0x3d9e56,
        roughness: 2,
        metalness: 0.1,
        flatShading: false,
        vertexColors: false
    });
    
    // Add more detailed color variations
    const colors = [];
    for (let i = 0; i < vertices.length; i += 3) {
        const y = vertices[i + 1];
        
        if (y < WATER_LEVEL + 5) {
            material.vertexColors = true;
            // Sandy beach color with slight variations
            const sandVariation = Math.random() * 0.05;
            colors.push(0.76 + sandVariation, 0.7 + sandVariation, 0.5 + sandVariation);
        } else if (y < WATER_LEVEL + 15) {
            material.vertexColors = true;
            // Blend between sand and grass with more natural transition
            const blend = (y - (WATER_LEVEL + 5)) / 10;
            const greenVariation = Math.random() * 0.05;
            colors.push(
                0.76 * (1 - blend) + (0.2 + greenVariation) * blend,
                0.7 * (1 - blend) + (0.6 + greenVariation) * blend,
                0.5 * (1 - blend) + (0.3 - greenVariation) * blend
            );
        } else if (y < WATER_LEVEL + 40) {
            // Regular grass/vegetation colors with variations
            const greenVariation = Math.random() * 0.1;
            colors.push(0.2 + greenVariation, 0.6 - greenVariation * 0.5, 0.3 - greenVariation);
        } else {
            // Higher elevation - slightly different color for mountain tops
            const stoneVariation = Math.random() * 0.05;
            colors.push(0.6 + stoneVariation, 0.6 + stoneVariation, 0.6 + stoneVariation);
        }
    }
    
    if (material.vertexColors) {
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    
    // Create a bump map for added detail
    const displacementTexture = new THREE.DataTexture(
        new Uint8Array(TERRAIN_SEGMENTS * TERRAIN_SEGMENTS).map(() => Math.random() * 255),
        TERRAIN_SEGMENTS,
        TERRAIN_SEGMENTS,
        THREE.RedFormat
    );
    displacementTexture.needsUpdate = true;
    material.displacementMap = displacementTexture;
    material.displacementScale = 2;
    
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);
    
    // Return both terrain and geometry for reference
    return { terrain, geometry };
}