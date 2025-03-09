import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Export the main function to create pigs
export function createPigs(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, PIG_COUNT) {
    const pigs = new THREE.Group();
    
    // Create a single pig with movement properties (directly copied from birds)
    for (let i = 0; i < PIG_COUNT; i++) {
        // Random position on terrain
        const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const y = Math.max(getTerrainHeight(x, z), WATER_LEVEL) + 5; // Above terrain
        
        const position = new THREE.Vector3(x, y, z);
        
        // Create pig group
        const pigGroup = new THREE.Group();
        pigGroup.position.copy(position);
        
        // Create temporary placeholder
        const tempGeometry = new THREE.BoxGeometry(6, 4, 8);
        const tempMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const tempPig = new THREE.Mesh(tempGeometry, tempMaterial);
        tempPig.castShadow = true;
        pigGroup.add(tempPig);
        
        // Add movement properties - copied directly from birds
        pigGroup.userData = { 
            id: Math.random(),
            speed: 0.3 + Math.random() * 0.3,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            lastTerrainY: y
        };
        
        // Load 3D model to replace placeholder
        const loader = new GLTFLoader();
        loader.load('./assets/pig.glb', (gltf) => {
            pigGroup.remove(tempPig); // Remove placeholder
            
            const model = gltf.scene;
            model.scale.set(35, 35, 35);
            // rotate model 90 degrees on the x axis
            model.rotation.y = -Math.PI / 2;
            pigGroup.add(model);
            
            // Enable shadows
            model.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            console.log("Pig model loaded at position:", pigGroup.position);
        });
        
        pigs.add(pigGroup);
    }
    
    scene.add(pigs);
    return pigs;
}

export function updatePigs(pigs, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    if (!pigs) return;
    
    // Directly adapted from bird update logic
    pigs.children.forEach(pig => {
        const data = pig.userData;
        
        // Update pig position in circular path (like birds)
        data.angle += data.speed * 0.01;
        
        // Calculate new position using circular motion
        const radius = data.radius + Math.sin(data.angle * 2) * 20;
        pig.position.x = Math.cos(data.angle) * radius;
        pig.position.z = Math.sin(data.angle) * radius;
        
        // Make pig follow terrain height
        const terrainY = getTerrainHeight(pig.position.x, pig.position.z);
        data.lastTerrainY = terrainY;
        pig.position.y = Math.max(terrainY, WATER_LEVEL) + 2;
        
        // Make pig face movement direction
        pig.rotation.y = -data.angle + Math.PI / 2;
        
        // Add slight bobbing for running animation
        pig.position.y += Math.sin(time * data.speed * 10) * 0.5;
    });
}