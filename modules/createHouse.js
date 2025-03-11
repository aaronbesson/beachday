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
        model.position.y = houseSize / 2 - 23; // Reset to 0 since we're using terrain height

        // Enable shadows for all meshes in the model
        model.traverse((node) => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
            }
        });

        // Create hollow interior cube for the house
        createHouseInterior(houseGroup, houseSize);

        houseGroup.add(model);
        // console.log("House model loaded at position:", houseGroup.position);
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

// Function to create a hollow cube for house interior
function createHouseInterior(houseGroup, houseSize) {
    // Interior dimensions (slightly smaller than the house)
    const interiorWidth = houseSize * 0.25;
    const interiorHeight = houseSize * 0.25;
    const interiorDepth = houseSize * 0.25;
    const wallThickness = 3;

    // Load cabin interior texture with proper error handling
    const textureLoader = new THREE.TextureLoader();
    let interiorTexture;

    try {
        interiorTexture = textureLoader.load(
            './assets/texture/cabin-interior.jpg',
            // Success callback
            function (texture) {
                // console.log("House interior texture loaded successfully");
            },
            // Progress callback
            undefined,
            // Error callback
            function (err) {
                console.error("Error loading house interior texture:", err);
                // Fallback to a plain brown color if texture fails to load
                updateInteriorMaterials(0x3F1800); // dark chocolate color
            }
        );

        // Set texture properties for proper tiling
        interiorTexture.wrapS = THREE.RepeatWrapping;
        interiorTexture.wrapT = THREE.RepeatWrapping;
        interiorTexture.repeat.set(1, 1);
    } catch (error) {
        console.error("Error setting up house interior texture:", error);
        interiorTexture = null;
    }

    // Material for interior walls with texture or fallback color
    const interiorMaterial = new THREE.MeshStandardMaterial({
        map: interiorTexture,
        color: interiorTexture ? 0xffffff : 0x8B4513, // Use white with texture or brown as fallback
        roughness: 0.8,
        metalness: 0.1,
        side: THREE.DoubleSide // Render both sides so we can see interior from outside
    });

    // Function to update materials if texture fails to load
    function updateInteriorMaterials(color) {
        interiorGroup.traverse((child) => {
            if (child.isMesh) {
                child.material.map = null;
                child.material.color.set(color);
                child.material.needsUpdate = true;
            }
        });
    }

    // Create a group for the interior
    const interiorGroup = new THREE.Group();

    // Position the interior relative to house center (accounting for house model positioning)
    interiorGroup.position.y = 10; // Adjusted to better match house height
    interiorGroup.position.x = -5;
    interiorGroup.position.z = 0;

    // Create 5 planes for the hollow cube (no bottom face for visibility)

    // Top face
    const topGeometry = new THREE.BoxGeometry(interiorWidth, wallThickness, interiorDepth);
    const topMesh = new THREE.Mesh(topGeometry, interiorMaterial.clone());
    topMesh.position.y = interiorHeight / 2;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    // Adjust texture scale for top if texture exists
    if (interiorTexture) {
        topMesh.material.map = interiorTexture.clone();
        topMesh.material.map.repeat.set(2, 2);
    }
    interiorGroup.add(topMesh);

    // Right face
    const rightGeometry = new THREE.BoxGeometry(wallThickness, interiorHeight, interiorDepth);
    const rightMesh = new THREE.Mesh(rightGeometry, interiorMaterial.clone());
    rightMesh.position.x = interiorWidth / 2;
    rightMesh.castShadow = true;
    rightMesh.receiveShadow = true;
    // Adjust texture scale for right wall if texture exists
    if (interiorTexture) {
        rightMesh.material.map = interiorTexture.clone();
        rightMesh.material.map.repeat.set(2, 1);
    }
    interiorGroup.add(rightMesh);

    // Left face
    const leftGeometry = new THREE.BoxGeometry(wallThickness, interiorHeight, interiorDepth);
    const leftMesh = new THREE.Mesh(leftGeometry, interiorMaterial.clone());
    leftMesh.position.x = -interiorWidth / 2;
    leftMesh.castShadow = true;
    leftMesh.receiveShadow = true;
    // Adjust texture scale for left wall if texture exists
    if (interiorTexture) {
        leftMesh.material.map = interiorTexture.clone();
        leftMesh.material.map.repeat.set(2, 1);
    }
    interiorGroup.add(leftMesh);

    // Front face
    const frontGeometry = new THREE.BoxGeometry(interiorWidth, interiorHeight, wallThickness);
    const frontMesh = new THREE.Mesh(frontGeometry, interiorMaterial.clone());
    frontMesh.position.z = interiorDepth / 2;
    frontMesh.castShadow = true;
    frontMesh.receiveShadow = true;
    // Adjust texture scale for front wall if texture exists
    if (interiorTexture) {
        frontMesh.material.map = interiorTexture.clone();
        frontMesh.material.map.repeat.set(2, 1);
    }
    interiorGroup.add(frontMesh);

    // Back face
    const backGeometry = new THREE.BoxGeometry(interiorWidth, interiorHeight, wallThickness);
    const backMesh = new THREE.Mesh(backGeometry, interiorMaterial.clone());
    backMesh.position.z = -interiorDepth / 2;
    backMesh.castShadow = true;
    backMesh.receiveShadow = true;
    // Adjust texture scale for back wall if texture exists
    if (interiorTexture) {
        backMesh.material.map = interiorTexture.clone();
        backMesh.material.map.repeat.set(2, 1);
    }
    interiorGroup.add(backMesh);

    // Add the interior structure to the house group
    houseGroup.add(interiorGroup);

    // Log to verify position
    // console.log("House interior created with textured walls");

    // Update footprint for collision detection
    houseFootprint = {
        size: houseSize,
        interiorSize: interiorWidth
    };

    // Store house position for reference
    housePosition = {
        x: houseGroup.position.x,
        y: houseGroup.position.y,
        z: houseGroup.position.z
    };
}