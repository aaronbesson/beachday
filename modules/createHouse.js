import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let housePosition = null;
let houseFootprint = null;

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
        ];

        let minHeight = Infinity;
        let maxHeight = -Infinity;

        // Check each point
        for (const point of points) {
            const height = getTerrainHeight(point.x, point.z);
            minHeight = Math.min(minHeight, height);
            maxHeight = Math.max(maxHeight, height);

            // Must be well above water
            if (height < WATER_LEVEL + 30) {
                return false;
            }
        }

        // Check if terrain is too steep (height difference between points)
        const slope = maxHeight - minHeight;
        if (slope > 20) { // Maximum allowed slope
            return false;
        }

        return true;
    }

    // Start point
    let x = 300;
    let z = 300;
    const houseSize = 120; // Size of house footprint

    // Search for suitable location in a spiral pattern
    let found = false;
    let searchRadius = 0;
    const maxSearchRadius = TERRAIN_SIZE * 0.5;
    const stepSize = 100; // Smaller steps for more precise placement
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
    const heightOffset = 2; // Minimal offset to prevent z-fighting
    const y = Math.max(terrainHeight, WATER_LEVEL + 30);

    // Create house group with position
    const houseGroup = new THREE.Group();
    houseGroup.position.set(x, y + heightOffset, z);

    // Load 3D model
    const loader = new GLTFLoader();
    loader.load('./assets/house.glb', (gltf) => {
        const model = gltf.scene;
        model.scale.set(100, 100, 100);
        model.rotation.y = Math.PI * 0.5;
        
        // Adjust model position relative to group
        model.position.y = houseSize/2 - 22; // Reset to 0 since we're using terrain height

        // Enable shadows for all meshes in the model
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Create wooden deck structure
        const deckGroup = new THREE.Group();
        
        // Wood materials
        const plankMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // dark wood color for planks
            roughness: 0.8,
            metalness: 0.1
        });
        
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x8b4513, // Darker wood color for supports
            roughness: 0.9,
            metalness: 0.1
        });

        // Create deck planks
        const plankWidth = (houseSize * 1.5) / 15;
        const plankGap = 0.5;
        const plankHeight = 2;
        const deckWidth = houseSize * 1.5;
        const deckDepth = houseSize * 1.5;

        for (let x = -deckWidth/2; x < deckWidth/2; x += plankWidth + plankGap) {
            const plankGeometry = new THREE.BoxGeometry(
                plankWidth - plankGap,
                plankHeight,
                deckDepth
            );
            const plank = new THREE.Mesh(plankGeometry, plankMaterial);
            plank.position.set(x + plankWidth/2, -houseSize/2 - 10, 0);
            plank.castShadow = true;
            plank.receiveShadow = true;
            deckGroup.add(plank);
        }

        // Add support poles
        const poleRadius = 4;
        const poleHeight = 60;
        const polePositions = [
            { x: -deckWidth/2 + poleRadius, z: -deckDepth/2 + poleRadius },
            { x: -deckWidth/2 + poleRadius, z: deckDepth/2 - poleRadius },
            { x: deckWidth/2 - poleRadius, z: -deckDepth/2 + poleRadius },
            { x: deckWidth/2 - poleRadius, z: deckDepth/2 - poleRadius },
            { x: 0, z: -deckDepth/2 + poleRadius },
            { x: 0, z: deckDepth/2 - poleRadius },
            { x: -deckWidth/4, z: 0 },
            { x: deckWidth/4, z: 0 }
        ];

        polePositions.forEach(pos => {
            const poleGeometry = new THREE.CylinderGeometry(
                poleRadius,
                poleRadius,
                poleHeight,
                8
            );
            const pole = new THREE.Mesh(poleGeometry, poleMaterial);
            pole.position.set(
                pos.x,
                -houseSize/2 - 10 - poleHeight/2,
                pos.z
            );
            pole.castShadow = true;
            pole.receiveShadow = true;
            deckGroup.add(pole);

            // Add decorative cap
            const capGeometry = new THREE.CylinderGeometry(
                poleRadius + 1,
                poleRadius + 1,
                2,
                8
            );
            const cap = new THREE.Mesh(capGeometry, poleMaterial);
            cap.position.set(pos.x, -houseSize/2 - 9, pos.z);
            cap.castShadow = true;
            deckGroup.add(cap);
        });

        // Add cross-beams
        const beamHeight = 4;
        const beamWidth = 4;
        const outerBeams = [
            { start: [-deckWidth/2, -deckDepth/2], end: [deckWidth/2, -deckDepth/2] },
            { start: [-deckWidth/2, deckDepth/2], end: [deckWidth/2, deckDepth/2] },
            { start: [-deckWidth/2, -deckDepth/2], end: [-deckWidth/2, deckDepth/2] },
            { start: [deckWidth/2, -deckDepth/2], end: [deckWidth/2, deckDepth/2] }
        ];

        outerBeams.forEach(beam => {
            const length = Math.sqrt(
                Math.pow(beam.end[0] - beam.start[0], 2) +
                Math.pow(beam.end[1] - beam.start[1], 2)
            );
            const beamGeometry = new THREE.BoxGeometry(length, beamHeight, beamWidth);
            const beamMesh = new THREE.Mesh(beamGeometry, poleMaterial);
            
            beamMesh.position.set(
                (beam.start[0] + beam.end[0])/2,
                -houseSize/2 - 25,
                (beam.start[1] + beam.end[1])/2
            );

            if (beam.start[1] === beam.end[1]) {
                // No rotation needed for X-axis beams
            } else {
                beamMesh.rotation.y = Math.PI/2;
            }

            beamMesh.castShadow = true;
            beamMesh.receiveShadow = true;
            deckGroup.add(beamMesh);
        });

        houseGroup.add(deckGroup);
        houseGroup.add(model);
        console.log("House model loaded at position:", houseGroup.position);
    });

    house.add(houseGroup);
    scene.add(house);

    // After finding the position, store it
    housePosition = { x, y, z };
    houseFootprint = { size: houseSize }; // Changed from 1.5 to 1.25 for tighter tree placement

    return house;
}

// Optional: Update function if you need to animate or modify the house
export function updateHouse(house, time, delta) {
    if (!house) return;
    // Add any update logic here if needed
    // For example, you could add subtle animations or effects
}

// Add getter functions
export function getHousePosition() {
    return housePosition;
}

export function getHouseFootprint() {
    return houseFootprint;
}