import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';

// Import our custom modules
import { createBirds, updateBirds } from './modules/createBirds.js';
import { createClouds, updateClouds } from './modules/createClouds.js';
import { createPigs, updatePigs } from './modules/createPigs.js';
import { createTerrain } from './modules/createTerrain.js';
import { createTrees } from './modules/createTrees.js';
import { PlayerCustomizer } from './playerCustomizer.js';

// Main scene variables
let scene, camera, renderer, controls, fpControls;
let terrain, water, sky, sun, directionalLight, clouds, birds, pigs, trees;
let clock = new THREE.Clock();

// Player settings
let player = {
    speed: 5,
    height: 0, // Height offset above terrain
    lastGroundY: 0, // Last detected ground height
    model: null, // Will store the squirrel model
    modelOffset: {x: 0, y: -3.0, z: 0}, // Offset for the model relative to camera
    jumpHeight: 5, // Jump height
    isJumping: false,
    jumpTime: 0.8,
    modelBaseHeight: 1.5, // Base height offset for the model
    shadow: null // Will store the player shadow
};

// Movement control state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let isLocked = false;

// Store terrain for height detection
let terrainGeometry;

// Parameters
const TERRAIN_SIZE = 3000; // small for testing
const TERRAIN_SEGMENTS = 124;
const TERRAIN_HEIGHT = 57;
const WATER_LEVEL = 2;
const SUN_HEIGHT = 400;
const TREE_COUNT = 500;
const CLOUD_COUNT = 20;
const BIRD_COUNT = 2;
const PIG_COUNT = 4; // Number of pigs in the herd

// Global variables for our application
let playerCustomizer;

// Add a flag to track if space is already pressed
let spacePressed = false;

// Initialize the scene
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    
    // Add fog for atmosphere
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);
    
    // Initialize underwater overlay
    const underwaterOverlay = document.getElementById('underwater-overlay');
    if (underwaterOverlay) {
        underwaterOverlay.style.opacity = '0';
    }
    
    // Debug marker removed - squirrel model is visible now
    
    // Create camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(24, 24, 150);
    camera.lookAt(0, 0, 0);
    
    // Create renderer
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('scene'),
        antialias: true,
        precision: 'highp'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Add orbit controls (for regular view)
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    
    // Create scene elements
    createSky();
    createLighting();
    
    // Create terrain from the module
    const terrainResult = createTerrain(scene, TERRAIN_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL);
    terrain = terrainResult.terrain;
    terrainGeometry = terrainResult.geometry;
    
    createWater();
    
    // Create trees from the module
    trees = createTrees(scene, terrain, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, TREE_COUNT);
    
    // Create clouds from the module
    clouds = createClouds(scene, TERRAIN_SIZE, CLOUD_COUNT);
    
    // Create birds from the module
    birds = createBirds(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, BIRD_COUNT);
    
    // Create pigs from the module
    pigs = createPigs(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, PIG_COUNT);
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Setup first-person controls and player
    setupPlayer();
    
    // Setup event listeners for UI
    setupEventListeners();

    // Print instructions to console
    console.log("WASD or Arrow Keys to move, Space to jump");
    console.log("Click anywhere to enter first-person mode, ESC to exit");
    
    // Start animation loop
    animate();
}

// Set up player and controls
function setupPlayer() {
    // Load the squirrel model
    const loader = new GLTFLoader();

    // load flying squirrel model if player is jumping
    const flyingSquirrelModel = './assets/flying-squirrel.glb';
    const regularSquirrelModel = './assets/squirrel.glb';
    
    
    loader.load(player.isJumping ? flyingSquirrelModel : regularSquirrelModel, (gltf) => { 
        console.log("Squirrel model loaded successfully", gltf);
        player.model = gltf.scene;
        
        // Add the model to the scene
        scene.add(player.model);
        
        // Scale model appropriately - adjust this value if needed
        player.model.scale.set(4, 4, 4);
        player.model.position.y += 5;
        
        // Set initial position - raised higher
        player.model.position.set(50, 50, 50); // Start in front of camera
        
        console.log("Squirrel model added to scene at:", player.model.position);
        
        // Create shadow for the player
        createPlayerShadow();
        
        // Initialize player customizer after model is loaded
        playerCustomizer = new PlayerCustomizer(scene, player);
    }, 
    // Progress callback
    (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
    }, 
    // Error callback
    (error) => {
        console.error("Error loading squirrel model:", error);
    });

    // Create pointer lock controls (now for third-person)
    fpControls = new PointerLockControls(camera, document.body);
    scene.add(fpControls.getObject());
    
    // Position the camera higher and behind for third-person view
    camera.position.set(0, 60, 30); // Higher and further behind
    fpControls.getObject().position.set(0, 60, 30); // Match camera position
    console.log("Camera initialized at position:", fpControls.getObject().position);
    
    // Add click event to enable pointer lock
    document.addEventListener('click', function(event) {
        // Check if the click is on the customizer UI or any UI element
        if (event.target.closest('#player-customizer') || 
            event.target.closest('.action-button') ||
            event.target.closest('.lightbox')) {
            // Don't activate pointer lock for UI interactions
            return;
        }
        
        console.log("Click detected, locking pointer");
        fpControls.lock();
    });
    
    // Lock/unlock events
    fpControls.addEventListener('lock', function() {
        isLocked = true;
        console.log("Pointer lock enabled - third person active");
        
        // Set initial height above terrain
        const camera = fpControls.getObject();
        const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
        player.lastGroundY = terrainY;
        camera.position.y = terrainY + player.height + 5; // Higher for third-person
        console.log("Initial terrain height:", terrainY, "Player Y:", camera.position.y);
        
        // Hide regular controls
        if (controls) controls.enabled = false;
    });
    
    fpControls.addEventListener('unlock', function() {
        isLocked = false;
        console.log("Pointer lock disabled - returning to orbit mode");
        // Re-enable orbit controls
        if (controls) controls.enabled = true;
    });
}

function swapSquirrelModel(isJumping) {
    // Remove current model if it exists
    if (player.model) {
        const currentPosition = player.model.position.clone();
        const currentRotation = player.model.rotation.clone();
        
        // Store whether controls were locked before swap
        const wasLocked = isLocked;
        
        // Remove from scene
        scene.remove(player.model);
        
        // Load appropriate model
        const loader = new GLTFLoader();
        const modelPath = isJumping ? './assets/flying-squirrel.glb' : './assets/squirrel.glb';
        
        loader.load(modelPath, (gltf) => {
            player.model = gltf.scene;
            scene.add(player.model);
            
            // Set appropriate scale based on which model is loaded
            if (isJumping) {
                // Flying squirrel adjustments
                player.model.scale.set(8, 6, 8);
            } else {
                // Regular squirrel scale
                player.model.scale.set(4, 4, 4);
            }
            
            // Apply position and rotation
            player.model.position.copy(currentPosition);
            player.model.rotation.copy(currentRotation);
            
            console.log(`Swapped to ${isJumping ? 'flying' : 'regular'} squirrel model`);
            
            // Make sure pointer lock is still active if it was before
            if (wasLocked && !isLocked) {
                console.log("Restoring pointer lock after model swap");
                fpControls.lock();
            }
        });
    }
}

// Modify shadow creation function for better visibility
function createPlayerShadow() {
    // Create a circular plane for the shadow
    const shadowRadius = 3; // Larger shadow radius
    const shadowGeometry = new THREE.CircleGeometry(shadowRadius, 32);
    
    // Create a radial gradient texture for the shadow
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    
    // Create radial gradient
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0.5)'); // Dark center
    gradient.addColorStop(1, 'rgba(0,0,0,0)');   // Transparent edges
    
    // Fill with gradient
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Create texture from canvas
    const shadowTexture = new THREE.CanvasTexture(canvas);
    
    // Create material with this texture
    const shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false
    });
    
    // Create the shadow mesh
    player.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    
    // Rotate to lie flat on the ground
    player.shadow.rotation.x = -Math.PI / 2;
    
    // Set initial position
    player.shadow.position.set(0, 0.1, 0); // Just above ground to prevent z-fighting
    
    // Add to scene
    scene.add(player.shadow);
    console.log("Player shadow created with gradient texture");
}

// Move the shadow update to a dedicated function for clarity
function updatePlayerShadow() {
    if (!player.model || !player.shadow) return;
    
    // Get terrain height directly below the player model
    const modelX = player.model.position.x;
    const modelZ = player.model.position.z;
    const terrainY = getTerrainHeight(modelX, modelZ);
    
    // Place shadow exactly on terrain surface with small offset
    const shadowY = Math.max(terrainY, WATER_LEVEL) + 0.8;
    
    // Update shadow position (x,z from player, y on terrain)
    player.shadow.position.x = modelX;
    player.shadow.position.z = modelZ;
    player.shadow.position.y = shadowY;
    
    // Calculate height of player above ground for shadow effects
    const heightAboveGround = player.model.position.y - shadowY;
    
    // Scale shadow based on height (smaller with distance)
    const scaleBase = 1.0;
    const scaleReduction = heightAboveGround / 50; // More gradual scaling
    const shadowScale = Math.max(0.5, scaleBase - scaleReduction);
    player.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    
    // Adjust opacity based on height (more transparent with distance)
    const opacityBase = 0.6; // Higher starting opacity
    const opacityReduction = heightAboveGround / 60; // More gradual fading
    player.shadow.material.opacity = Math.max(0.1, opacityBase - opacityReduction);
}

// Very simple key controls
function setupEventListeners() {
    document.addEventListener('keydown', function(event) {
        console.log("Key pressed:", event.code); // Debug log to see key presses
        
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = true;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = true;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = true;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = true;
                break;
            case 'Space':
                // Only jump if space wasn't already pressed and not already jumping
                if (!spacePressed && !player.isJumping && player.model) {
                    spacePressed = true;
                    player.isJumping = true;
                    // Add upward velocity by setting Y position higher
                    player.model.position.y += player.jumpHeight;
                    console.log("JUMP! Starting Y:", player.model.position.y);
                    
                    // Swap to flying squirrel model
                    swapSquirrelModel(true);
                }
                break;
        }
    });
    
    document.addEventListener('keyup', function(event) {
        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
                moveForward = false;
                break;
            case 'KeyA':
            case 'ArrowLeft':
                moveLeft = false;
                break;
            case 'KeyS':
            case 'ArrowDown':
                moveBackward = false;
                break;
            case 'KeyD':
            case 'ArrowRight':
                moveRight = false;
                break;
            case 'Space':
                // Reset space pressed flag on key up
                spacePressed = false;
                break;
        }
    });
    
    // Add event listener for the customizer button
    document.getElementById('open-customizer').addEventListener('click', () => {
        if (playerCustomizer) {
            playerCustomizer.toggle();
        }
    });
}

// Create lighting
function createLighting() {
    // Add directional light (sun)
    directionalLight = new THREE.DirectionalLight(0xfffafa, 1.2);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    
    // Configure shadow properties
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 800;
    
    // Increase shadow camera size to cover the terrain
    const shadowSize = TERRAIN_SIZE / 1.8;
    directionalLight.shadow.camera.left = -shadowSize;
    directionalLight.shadow.camera.right = shadowSize;
    directionalLight.shadow.camera.top = shadowSize;
    directionalLight.shadow.camera.bottom = -shadowSize;
    
    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;
    
    scene.add(directionalLight);
    
    // Add hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);
    
    // Add subtle point lights for more depth
    const pointLight1 = new THREE.PointLight(0xff7e47, 0.5, 250);
    pointLight1.position.set(100, 50, 100);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x4ca7ff, 0.3, 250);
    pointLight2.position.set(-100, 50, -100);
    scene.add(pointLight2);
}

// Create sky with sun
function createSky() {
    sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    
    sun = new THREE.Vector3();
    
    const skyParams = {
        turbidity: 8, // Reduced for clearer sky
        rayleigh: 1.5, // Adjusted for better sky color
        mieCoefficient: 0.005,
        mieDirectionalG: 0.9, // Increased for more pronounced sun glow
        elevation: 30,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };
    
    // Instead of creating a visible sun, we'll just track the position
    // for lighting and environment purposes
    
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    function updateSun() {
        const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation);
        const theta = THREE.MathUtils.degToRad(skyParams.azimuth);
        
        sun.setFromSphericalCoords(1, phi, theta);
        
        // Update sky with sun position (no visible sun)
        sky.material.uniforms['sunPosition'].value.copy(sun);
        
        if (water) {
            water.material.uniforms['sunDirection'].value.copy(sun).normalize();
        }
        
        // Update directional light position to match sun position
        if (directionalLight) {
            directionalLight.position.set(
                sun.x * 100,
                sun.y * 100,
                sun.z * 100
            );
        }
        
        scene.environment = pmremGenerator.fromScene(sky).texture;
    }
    
    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = skyParams.turbidity;
    skyUniforms['rayleigh'].value = skyParams.rayleigh;
    skyUniforms['mieCoefficient'].value = skyParams.mieCoefficient;
    skyUniforms['mieDirectionalG'].value = skyParams.mieDirectionalG;
    
    updateSun();
}

// Create reflective water
function createWater() {
    const waterGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 128, 128);
    
    water = new Water(
        waterGeometry,
        {
            textureWidth: 1024,
            textureHeight: 1024,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function(texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(8, 8);
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff,
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined,
            reflectivity: 0.9
        }
    );
    
    water.rotation.x = -Math.PI / 2;
    water.position.y = WATER_LEVEL + 6;

    water.material.side = THREE.DoubleSide;
    
    scene.add(water);
}

// Get height at specific x,z position on terrain
function getTerrainHeight(x, z) {
    if (!terrainGeometry) return 0;
    
    try {
        // First attempt: Use raycasting for precise detection
        const raycaster = new THREE.Raycaster();
        raycaster.set(
            new THREE.Vector3(x, 1000, z), // Start high above terrain
            new THREE.Vector3(0, -1, 0)    // Cast downward
        );
        
        // Intersect with terrain mesh
        const intersects = raycaster.intersectObject(terrain);
        
        if (intersects.length > 0) {
            // console.log("Found terrain height via raycast:", intersects[0].point.y);
            return intersects[0].point.y;
        }
        
        // Second attempt: Try to calculate from terrain geometry
        const terrainSize = TERRAIN_SIZE;
        const segments = TERRAIN_SEGMENTS;
        
        // Convert world position to geometry indices
        const halfSize = terrainSize / 2;
        const xIndex = Math.floor(((x + halfSize) / terrainSize) * segments);
        const zIndex = Math.floor(((z + halfSize) / terrainSize) * segments);
        
        // Validate indices
        if (xIndex >= 0 && xIndex <= segments && zIndex >= 0 && zIndex <= segments) {
            // Get vertex index
            const vertexIndex = (zIndex * (segments + 1) + xIndex) * 3 + 1; // +1 for y component
            
            // Get height from geometry
            if (terrainGeometry.attributes && terrainGeometry.attributes.position) {
                const y = terrainGeometry.attributes.position.array[vertexIndex];
                console.log("Found terrain height via geometry:", y);
                return y;
            }
        }
    } catch (error) {
        console.warn("Error getting terrain height:", error);
    }
    
    // Return last known ground height or default value
    console.warn("Using fallback terrain height");
    return player.lastGroundY > 0 ? player.lastGroundY : 0;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = clock.getElapsedTime();
    const delta = clock.getDelta();
    
    // SIMPLE MOVEMENT - directional keys
    if (isLocked) {
        // Movement speed
        const speed = player.speed;
        
        // Store previous position
        const camera = fpControls.getObject();
        const prevX = camera.position.x;
        const prevZ = camera.position.z;
        
        // Calculate movement direction
        if (moveForward) {
            fpControls.moveForward(speed);
        }
        if (moveBackward) {
            fpControls.moveForward(-speed);
        }
        if (moveLeft) {
            fpControls.moveRight(-speed);
        }
        if (moveRight) {
            fpControls.moveRight(speed);
        }
        
        // Get terrain height for camera position
        const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
        player.lastGroundY = terrainY;
        
        // Base camera height when not jumping
        const baseHeight = Math.max(terrainY, WATER_LEVEL + 0.5) + player.height + 5;
        
        // If player is jumping, adjust camera height to follow
        if (player.isJumping && player.model) {
            // Calculate how high above terrain the model is
            const modelHeightAboveTerrain = player.model.position.y;
            
            // Apply the same height offset to the camera
            camera.position.y = player.model.position.y;
        } else {
            // Normal terrain following when not jumping
            camera.position.y = baseHeight;
        }
        
        // Check if player is underwater and update overlay
        const underwaterOverlay = document.getElementById('underwater-overlay');
        if (terrainY < 0.5) {
            if (underwaterOverlay) underwaterOverlay.style.opacity = '0.5';
        } else {
            if (underwaterOverlay) underwaterOverlay.style.opacity = '0';
        }
        
        // Update squirrel model position in the animate function
        if (player.model) {
            // Calculate direction vector
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            // Position the model ahead of the camera
            const modelDistance = 15; // Increased distance in front of camera
            const modelX = camera.position.x + direction.x * modelDistance;
            const modelZ = camera.position.z + direction.z * modelDistance;
            
            // Get the terrain height for the model
            const modelTerrainY = getTerrainHeight(modelX, modelZ);
            const modelMinHeight = Math.max(modelTerrainY, WATER_LEVEL + 0.5);
            
            // Set model X and Z position
            player.model.position.x = modelX;
            player.model.position.z = modelZ;
            
            // Handle Y position based on whether we're jumping or not
            if (player.isJumping) {
                // Apply gravity effect when jumping
                player.model.position.y -= 0.8; // Apply gravity when jumping
                
                // Check if we've landed
                if (player.model.position.y <= modelMinHeight + player.modelBaseHeight) {
                    player.isJumping = false;
                    player.model.position.y = modelMinHeight + player.modelBaseHeight + 1; // Increased height offset
                    console.log("Landed!");
                    
                    // Swap back to regular squirrel model
                    swapSquirrelModel(false);
                }
            } else {
                // When not jumping, always keep model at exact terrain height plus offset
                player.model.position.y = modelMinHeight + player.modelBaseHeight + 1; // Increased height offset
            }
            
            // Make model face the direction of movement
            if (prevX !== camera.position.x || prevZ !== camera.position.z) {
                // Calculate angle based on camera movement direction
                const angle = Math.atan2(
                    camera.position.x - prevX,
                    camera.position.z - prevZ
                );
                // Apply rotation
                const targetRotation = angle;
                player.model.rotation.y = targetRotation;
            }
        }
    } else {
        // Update orbit controls
        if (controls) controls.update();
    }
    
    // Update water animation
    if (water) {
        water.material.uniforms['time'].value = time;
    }
    
    // Update sun effects
    scene.traverse(function(object) {
        if (object.isMesh && object.material.type === 'ShaderMaterial' && object.material.uniforms && object.material.uniforms.time) {
            object.material.uniforms.time.value = time;
        }
    });
    
    // Update cloud positions using the imported function
    updateClouds(clouds, time, delta, TERRAIN_SIZE);
    
    // Update bird animation using the imported function
    updateBirds(birds, time, delta);
    
    // Update pigs using the imported function
    updatePigs(pigs, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    
    // Update player shadow position
    updatePlayerShadow();
    
    // Update compass direction
    if (isLocked && fpControls) {
        const compassArrow = document.getElementById('compass-arrow');
        if (compassArrow) {
            const camera = fpControls.getObject();
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            // Calculate angle in degrees from camera direction
            const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
            
            // Update compass arrow rotation
            compassArrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        }
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Start the application
init(); 