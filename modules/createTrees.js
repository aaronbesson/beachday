import * as THREE from 'three';
import { getHousePosition, getHouseFootprint } from './createHouse.js';

export function createTrees(
    scene,
    terrain,
    TERRAIN_SIZE,
    WATER_LEVEL,
    getTerrainHeight,
    TREE_COUNT
) {
    // Create a group to hold all trees
    const trees = new THREE.Group();
    
    // Create array to store tree collision data
    const treeColliders = [];
    
    // Find positions on terrain that are above water level
    const potentialPositions = [];
    const terrainVertices = terrain.geometry.attributes.position.array;
    
    for (let i = 0; i < terrainVertices.length; i += 3) {
        const x = terrainVertices[i];
        const y = terrainVertices[i + 1];
        const z = terrainVertices[i + 2];
        
        // Only place trees on terrain above water + 5 units
        if (y > WATER_LEVEL + 5) {
            potentialPositions.push(new THREE.Vector3(x, y, z));
        }
    }
    
    // Add function to check if position is too close to house
    function isTooCloseToHouse(position) {
        const housePos = getHousePosition();
        const houseSize = getHouseFootprint()?.size || 0;
        
        if (!housePos) return false;
        
        // Calculate distance from tree to house center
        const dx = position.x - housePos.x;
        const dz = position.z - housePos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Return true if too close (within house footprint + margin)
        return distance < houseSize;
    }
    
    // Function to create a high-poly tree
    function createTree(position, size) {
        const treeGroup = new THREE.Group();
        
        // Create detailed trunk with texture
        const trunkGeometry = new THREE.CylinderGeometry(size * 0.5, size * 0.7, size * 4, 12, 5);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            roughness: 0.9,
            metalness: 0.1,
            onBeforeCompile: shader => {
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    float noise = sin(position.y * 10.0) * 0.05 + sin(position.y * 20.0 + position.x * 5.0) * 0.02;
                    transformed.x += noise * normal.x;
                    transformed.z += noise * normal.z;
                    `
                );
            }
        });
        
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = size * 1;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);
        
        // Create detailed foliage with multiple layers
        const foliageLayers = 1 + Math.floor(Math.random() * 5);
        const foliageMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x228b22,
            roughness: 0.8,
            metalness: 0.01,
            flatShading: true
        });
        
        for (let i = 0; i < foliageLayers; i++) {
            // Use more detailed geometry
            const foliageGeometry = new THREE.IcosahedronGeometry(
                size * (3 - i * 0.5),
                2
            );
            
            // Add variation to vertices
            const positions = foliageGeometry.attributes.position.array;
            for (let j = 0; j < positions.length; j += 3) {
                positions[j] += (Math.random() - 0.5) * size * 0.1;
                positions[j + 1] += (Math.random() - 0.5) * size * 0.1;
                positions[j + 2] += (Math.random() - 0.5) * size * 0.1;
            }
            foliageGeometry.computeVertexNormals();
            
            const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial.clone());
            
            // Vary colors slightly for each layer
            foliage.material.color.setHSL(
                0.3 + Math.random() * 0.05,
                0.6 + Math.random() * 0.1,
                0.4 + Math.random() * 0.1
            );
            
            foliage.position.y = size * (6 + i * 1.5);
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            treeGroup.add(foliage);
        }
        
        // Position the tree
        treeGroup.position.set(position.x, position.y, position.z);
        
        // Random rotation for variety
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        
        // Add collision data for this tree
        const collisionRadius = size * 0.6; // Reduced from 0.8 to make collisions less restrictive
        treeColliders.push({
            position: new THREE.Vector3(position.x, position.y, position.z),
            radius: collisionRadius
        });
        
        return treeGroup;
    }
    
    // Modify the tree creation loop
    for (let i = 0; i < Math.min(TREE_COUNT, potentialPositions.length); i++) {
        const randomIndex = Math.floor(Math.random() * potentialPositions.length);
        const position = potentialPositions[randomIndex];
        
        // Skip this position if it's too close to the house
        if (isTooCloseToHouse(position)) {
            potentialPositions.splice(randomIndex, 1);
            i--; // Try again with next position
            continue;
        }
        
        // Remove the selected position to avoid placing multiple trees at the same spot
        potentialPositions.splice(randomIndex, 1);
        
        // Random tree size
        const size = 0.2 + Math.random() * 14;
        
        const tree = createTree(position, size);
        trees.add(tree); // Add to trees group instead of directly to scene
    }
    
    // Add the trees group to the scene
    scene.add(trees);
    
    // Return the trees group and collision data
    return { trees, treeColliders };
}