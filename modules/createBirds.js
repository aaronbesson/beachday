// Create high-poly birds

import * as THREE from 'three';

export function createBirds(
    scene,
    TERRAIN_SIZE,
    WATER_LEVEL,
    getTerrainHeight,
    BIRD_COUNT
) {
    const birds = new THREE.Group();
    
    // Function to create a single detailed bird
    function createBird(position, size) {
        const birdGroup = new THREE.Group();
        
        // Create bird body with more detail
        const bodyGeometry = new THREE.ConeGeometry(size, size * 3, 8, 3);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: false
        });
        
        // Add noise to body
        const bodyPositions = bodyGeometry.attributes.position.array;
        for (let i = 0; i < bodyPositions.length; i += 3) {
            bodyPositions[i] += (Math.random() - 0.5) * size * 0.1;
            bodyPositions[i + 1] += (Math.random() - 0.5) * size * 0.1;
            bodyPositions[i + 2] += (Math.random() - 0.5) * size * 0.1;
        }
        bodyGeometry.computeVertexNormals();
        
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        birdGroup.add(body);
        
        // Create more detailed wings
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.quadraticCurveTo(size * 2, size * 0.5, size * 4, 0);
        wingShape.quadraticCurveTo(size * 2, -size * 0.5, 0, 0);
        
        const wingGeometry = new THREE.ShapeGeometry(wingShape, 16);
        const wingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x222222,
            side: THREE.DoubleSide,
            flatShading: false,
            transparent: true,
            opacity: 0.9
        });
        
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-size * 0, 0, 0);
        leftWing.rotation.y = Math.PI / 4;
        birdGroup.add(leftWing);
        
        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(size * 0, 0, 0);
        rightWing.rotation.y = -Math.PI / 4;
        birdGroup.add(rightWing);
        
        // Add tail feathers
        const tailGeometry = new THREE.ConeGeometry(size * 0.5, size * 2, 4, 1);
        const tail = new THREE.Mesh(tailGeometry, bodyMaterial.clone());
        tail.position.set(0, 0, -size * 2);
        tail.rotation.x = -Math.PI / 6;
        birdGroup.add(tail);
        
        // Add head
        const headGeometry = new THREE.SphereGeometry(size * 0.6, 8, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial.clone());
        head.position.set(0, 0, size * 1.8);
        birdGroup.add(head);
        
        // Add beak
        const beakGeometry = new THREE.ConeGeometry(size * 0.2, size * 0.8, 4, 1);
        const beakMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc00 });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0, 0, size * 2.5);
        beak.rotation.x = -Math.PI / 2;
        birdGroup.add(beak);
        
        // Position the bird
        birdGroup.position.copy(position);
        
        // Add unique ID and flight data for animation
        birdGroup.userData = { 
            id: Math.random(),
            speed: 0.3 + Math.random() * 0.3,
            wingSpeed: 0.1 + Math.random() * 0.2,
            radius: 50 + Math.random() * 200,
            height: position.y,
            angle: Math.random() * Math.PI * 2,
            wingAngle: 0
        };
        
        return birdGroup;
    }
    
    // Create birds at random positions
    for (let i = 0; i < BIRD_COUNT; i++) {
        // Random position
        const x = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const y = 50 + Math.random() * 100;
        const z = (Math.random() - 0.5) * TERRAIN_SIZE * 0.7;
        const position = new THREE.Vector3(x, y, z);
        
        // Random bird size
        const size = 1 + Math.random() * 1.5;
        
        const bird = createBird(position, size);
        birds.add(bird);
    }
    
    scene.add(birds);
    return birds;
}

export function updateBirds(birds, time, delta) {
    if (!birds) return;
    
    birds.children.forEach(bird => {
        const data = bird.userData;
        
        // Update bird position in circular flight
        data.angle += data.speed * 0.01;
        
        // More natural flight path
        const radius = data.radius + Math.sin(data.angle * 2) * 20;
        bird.position.x = Math.cos(data.angle) * radius;
        bird.position.z = Math.sin(data.angle) * radius;
        
        // Vertical movement with smoother curves
        const verticalOffset = Math.sin(data.angle * 3) * 10 + Math.sin(data.angle * 7) * 5;
        bird.position.y = data.height + verticalOffset;
        
        // More natural banking in turns
        const bankAngle = Math.cos(data.angle) * 0.2;
        bird.rotation.z = bankAngle;
        
        // Make bird face the direction it's flying with natural head movement
        bird.rotation.y = -data.angle + Math.PI / 2 + Math.sin(time * 0.5) * 0.1;
        
        // More natural wing flapping with asymmetry
        data.wingAngle = Math.sin(time * data.wingSpeed * 10) * 0.4;
        const leftWingAngle = Math.PI / 4 + data.wingAngle;
        const rightWingAngle = -Math.PI / 4 - data.wingAngle;
        
        if (bird.children[1]) bird.children[1].rotation.y = leftWingAngle;
        if (bird.children[2]) bird.children[2].rotation.y = rightWingAngle;
        
        // Subtle tail movement
        if (bird.children[3]) {
            bird.children[3].rotation.x = -Math.PI / 6 + Math.sin(time * data.wingSpeed * 5) * 0.1;
        }
    });
}