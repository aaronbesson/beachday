import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create house
export function createHouse(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    const house = new THREE.Group();

    // Function to check if a position is suitable for the house
    function isLocationSuitable(x, z, size) {
        // Check multiple points around the house footprint
        const points = [
            { x: x, z: z },                    // Center
            { x: x + size / 2, z: z + size / 2 },  // Front right
            { x: x + size / 2, z: z - size / 2 },  // Back right
            { x: x - size / 2, z: z + size / 2 },  // Front left
            { x: x - size / 2, z: z - size / 2 },  // Back left
            { x: x, z: z + size / 2 },           // Front center
            { x: x, z: z - size / 2 },           // Back center
            { x: x + size / 2, z: z },           // Right center
            { x: x - size / 2, z: z }            // Left center
        ];

        // Check each point
        for (const point of points) {
            const height = getTerrainHeight(point.x, point.z);
            // Ensure it's well above water level and not too steep
            if (height < WATER_LEVEL + 15) {
                return false;
            }
        }
        return true;
    }

    // Start from center of map
    let x = 0;
    let z = 0;
    const houseSize = 100; // Size of house footprint

    // Search for suitable location in a spiral pattern
    let found = false;
    let searchRadius = 0;
    const maxSearchRadius = TERRAIN_SIZE * 0.3;
    const stepSize = 20; // Smaller steps for more precise placement
    const spiralSteps = 16; // Number of points to check in each spiral ring

    while (!found && searchRadius < maxSearchRadius) {
        // Check current position first
        if (isLocationSuitable(x, z, houseSize)) {
            found = true;
            break;
        }

        // Search in a spiral pattern
        searchRadius += stepSize;
        for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / spiralSteps) {
            x = Math.cos(angle) * searchRadius;
            z = Math.sin(angle) * searchRadius;

            if (isLocationSuitable(x, z, houseSize)) {
                found = true;
                break;
            }
        }
    }

    // If we still haven't found a spot, find the highest nearby point
    if (!found) {
        console.warn("Could not find ideal house location, searching for highest point");
        let highestPoint = -Infinity;
        let bestX = 0;
        let bestZ = 0;

        // Search in a grid pattern near center
        for (let searchX = -100; searchX <= 100; searchX += 20) {
            for (let searchZ = -100; searchZ <= 100; searchZ += 20) {
                const height = getTerrainHeight(searchX, searchZ);
                if (height > highestPoint && height > WATER_LEVEL + 20) {
                    highestPoint = height;
                    bestX = searchX;
                    bestZ = searchZ;
                }
            }
        }
        x = bestX;
        z = bestZ;
    }

    // Get final terrain height and add offset
    const terrainHeight = getTerrainHeight(x, z);
    const heightOffset = 50;
    const y = Math.max(terrainHeight, WATER_LEVEL + 20) + heightOffset;

    // Create house group with position
    const houseGroup = new THREE.Group();
    houseGroup.position.set(x, y, z);

    // Load 3D model
    const loader = new GLTFLoader();
    loader.load('./assets/house.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(100, 100, 100);

        /// rotate the house 180 degrees
        model.rotation.y = Math.PI * 0.5;

        // Enable shadows for all meshes in the model
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Add foundation platform under the house
        const foundationGeometry = new THREE.BoxGeometry(houseSize * 1.5, 60, houseSize * 1.5);
        const foundationMaterial = new THREE.MeshStandardMaterial({
            color: 0x808080,
            roughness: 0.7,
            metalness: 0.2
        });
        const foundation = new THREE.Mesh(foundationGeometry, foundationMaterial);
        foundation.position.y = -houseSize / 2 - 22; // Position at bottom of house
        foundation.castShadow = true;
        foundation.receiveShadow = true;



        // // Add some terrain flattening around the house
        // const platformGeometry = new THREE.BoxGeometry(houseSize * 2, 5, houseSize * 2);
        // const platformMaterial = new THREE.MeshStandardMaterial({ 
        //     color: 0x567d46,
        //     roughness: 0.9,
        //     metalness: 0.1
        // });
        // const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        // platform.position.y = -houseSize/2 - 10; // Just below foundation
        // platform.receiveShadow = true;

        // houseGroup.add(platform);
        houseGroup.add(foundation);
        houseGroup.add(model);
        console.log("House model loaded at position:", houseGroup.position);
    });

    house.add(houseGroup);
    scene.add(house);
    return house;
}

// Optional: Update function if you need to animate or modify the house
export function updateHouse(house, time, delta) {
    if (!house) return;
    // Add any update logic here if needed
    // For example, you could add subtle animations or effects
}