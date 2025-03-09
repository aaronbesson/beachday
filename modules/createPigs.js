import * as THREE from 'three';

// Export the main function to create pigs
export function createPigs(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, PIG_COUNT) {
    const pigs = new THREE.Group();
    scene.add(pigs);
    
    // Function to create a single pig with random properties
    function createPig() {
        // Find a valid position on land (not in water)
        let x, z, terrainY, y;
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loops
        
        do {
            // Random position within terrain bounds
            x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6;
            z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.6;
            
            // Get terrain height at position
            terrainY = getTerrainHeight(x, z);
            y = terrainY + 1;
            
            attempts++;
        } while (terrainY < WATER_LEVEL && attempts < maxAttempts);
        
        // If we couldn't find a position after max attempts, use highest found
        if (attempts >= maxAttempts) {
            console.warn("Could not find dry land for pig after max attempts");
        }
        
        // Random size variance for the pig
        const scale = 0.75;
        
        // Create a placeholder while the model loads
        const pigGroup = new THREE.Group();
        pigGroup.position.set(x, y + 2, z); // Slight offset to prevent ground clipping
        
        // Add pig-specific movement data
        pigGroup.userData = {
            id: Math.random(),
            initialX: x,
            initialZ: z,
            scale: scale,
            speed: 0.2 + Math.random() * 0.3,
            direction: new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(),
            moveTime: 0,
            moveDuration: 4 + Math.random() * 3, // Time to move in one direction
            restTime: 0,
            restDuration: 2 + Math.random() * 2, // Time to rest between movements
            isResting: Math.random() > 0.7, // Some pigs start resting
            lastTerrainY: y,
            avoidWater: true // Flag to make pigs avoid water
        };
        
        // Create a bright pink cylinder for the pig body
        const bodyHeight = 4 * scale;
        const bodyRadius = 2 * scale;
        const bodyGeometry = new THREE.CylinderGeometry(bodyRadius, bodyRadius, bodyHeight, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff69b4, // Hot pink
            roughness: 0.7,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2; // Lay cylinder on its side
        
        // Create head
        const headRadius = bodyRadius * 0.8;
        const headGeometry = new THREE.SphereGeometry(headRadius, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0, 0, bodyHeight/2 + headRadius*0.3); // Position at front of body
        
        // Create ears (small cylinders)
        const earGeometry = new THREE.CylinderGeometry(0, headRadius*0.4, headRadius, 4);
        const earMaterial = new THREE.MeshStandardMaterial({ color: 0xff1493 }); // Deeper pink
        
        const leftEar = new THREE.Mesh(earGeometry, earMaterial);
        leftEar.position.set(headRadius*0.7, headRadius*0.7, bodyHeight/2 + headRadius*0.3);
        leftEar.rotation.z = Math.PI/4;
        
        const rightEar = new THREE.Mesh(earGeometry, earMaterial);
        rightEar.position.set(-headRadius*0.7, headRadius*0.7, bodyHeight/2 + headRadius*0.3);
        rightEar.rotation.z = -Math.PI/4;
        
        // Create legs (4 cylinders)
        const legGeometry = new THREE.CylinderGeometry(bodyRadius*0.2, bodyRadius*0.2, bodyRadius*1.2, 6);
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        
        const frontLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
        frontLeftLeg.position.set(bodyRadius*0.6, -bodyRadius*0.6, bodyHeight/3);
        
        const frontRightLeg = new THREE.Mesh(legGeometry, legMaterial);
        frontRightLeg.position.set(-bodyRadius*0.6, -bodyRadius*0.6, bodyHeight/3);
        
        const backLeftLeg = new THREE.Mesh(legGeometry, legMaterial);
        backLeftLeg.position.set(bodyRadius*0.6, -bodyRadius*0.6, -bodyHeight/3);
        
        const backRightLeg = new THREE.Mesh(legGeometry, legMaterial);
        backRightLeg.position.set(-bodyRadius*0.6, -bodyRadius*0.6, -bodyHeight/3);
        
        // Create tail (small curved cylinder)
        const tailGeometry = new THREE.CylinderGeometry(bodyRadius*0.15, bodyRadius*0.05, bodyRadius, 6);
        const tailMaterial = new THREE.MeshStandardMaterial({ color: 0xff69b4 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(0, bodyRadius*0.4, -bodyHeight/2 - bodyRadius*0.2);
        tail.rotation.x = Math.PI/3;
        
        // Add all parts to the pig group
        pigGroup.add(body, head, leftEar, rightEar, frontLeftLeg, frontRightLeg, backLeftLeg, backRightLeg, tail);
        
        // Add the pig group to the pigs collection
        pigs.add(pigGroup);
        
        console.log("Created pink cylinder pig at position:", x, y, z);
        
        return pigGroup;
    }
    
    // Create a herd of pigs
    for (let i = 0; i < PIG_COUNT; i++) {
        createPig();
    }
    
    return pigs;
}

// Export the function to update pig positions and animations
export function updatePigs(pigs, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight) {
    if (!pigs) return;
    
    pigs.children.forEach(pig => {
        const data = pig.userData;
        
        // Pig movement logic - alternates between moving and resting
        if (data.isResting) {
            // Pig is resting
            data.restTime += delta;
            
            // Switch to moving after rest duration
            if (data.restTime >= data.restDuration) {
                data.isResting = false;
                data.restTime = 0;
                data.moveTime = 0;
                
                // Choose a new random direction
                data.direction = new THREE.Vector3(
                    Math.random() - 0.5,
                    0,
                    Math.random() - 0.5
                ).normalize();
            }
        } else {
            // Pig is moving
            data.moveTime += delta;
            
            // Calculate new position
            const moveDistance = data.speed * delta;
            const newX = pig.position.x + data.direction.x * moveDistance;
            const newZ = pig.position.z + data.direction.z * moveDistance;
            
            // Check terrain boundaries
            const halfSize = TERRAIN_SIZE * 0.45; // Keep away from edges
            let shouldChangeDirection = false;
            
            if (newX > halfSize || newX < -halfSize || newZ > halfSize || newZ < -halfSize) {
                // Turn around if near edge
                shouldChangeDirection = true;
            } else {
                // Get terrain height at the new position
                const newTerrainY = getTerrainHeight(newX, newZ);
                
                // Check if the new position would be in water and pig avoids water
                if (data.avoidWater && newTerrainY < WATER_LEVEL) {
                    // Change direction to avoid water
                    shouldChangeDirection = true;
                } else {
                    // Update position
                    pig.position.x = newX;
                    pig.position.z = newZ;
                    
                    // Get terrain height and adjust pig's y position
                    const terrainY = getTerrainHeight(pig.position.x, pig.position.z);
                    data.lastTerrainY = terrainY;
                    
                    // Place pig on terrain
                    pig.position.y = terrainY + 0.5; // Small offset from ground
                }
            }
            
            // Change direction if needed
            if (shouldChangeDirection) {
                // Pick a new random direction
                data.direction = new THREE.Vector3(
                    Math.random() - 0.5,
                    0,
                    Math.random() - 0.5
                ).normalize();
            }
            
            // Make pig face direction of movement
            if (pig.children.length > 0) {
                pig.rotation.y = Math.atan2(data.direction.x, data.direction.z);
            }
            
            // Add a subtle bobbing motion while moving
            const bobAmount = Math.sin(time * 5 * data.speed) * 0.2;
            pig.position.y = data.lastTerrainY + 0.5 + bobAmount;
            
            // Switch to resting after move duration
            if (data.moveTime >= data.moveDuration) {
                data.isResting = true;
                data.moveTime = 0;
                data.restTime = 0;
                
                // New rest duration
                data.restDuration = 2 + Math.random() * 2;
            }
        }
    });
}