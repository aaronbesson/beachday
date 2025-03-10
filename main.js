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
import { createHippos, updateHippos } from './modules/createHippos.js';
import { createTerrain } from './modules/createTerrain.js';
import { createTrees } from './modules/createTrees.js';
import { PlayerCustomizer } from './playerCustomizer.js';
import { createSharks, updateSharks } from './modules/createSharks.js';
import { createBears, updateBears } from './modules/createBears.js';
import { createLevelBoss, updateLevelBoss } from './modules/createLevelBoss.js';
import { createHouse, updateHouse } from './modules/createHouse.js';

// Main scene variables
let scene, camera, renderer, controls, fpControls;
let terrain, water, sky, sun, directionalLight, clouds, birds, pigs, trees, sharks, hippos, bears, levelBoss, house;
let clock = new THREE.Clock();
let crosshair;

// Variables for shooting mechanic
let stones = [];
let stoneGeometry, stoneMaterial;
let lastShotTime = 0;
const SHOT_COOLDOWN = 0.75; // Cooldown between shots in seconds

// Player settings
let player = {
    speed: 7,
    height: 0,
    lastGroundY: 0,
    model: null,
    modelOffset: {x: 0, y: -20.0, z: 0},
    jumpHeight: 5,
    isJumping: false,
    jumpTime: 0.8,
    modelBaseHeight: 1.5,
    shadow: null,
    flyingModel: null,
    regularModel: null
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
const TERRAIN_SIZE = 2400;
const TERRAIN_SEGMENTS = 50;
const WATER_LEVEL = 8;
const SHARK_COUNT = 12;
const TREE_COUNT = 360;
const CLOUD_COUNT = 0;
const BIRD_COUNT = 0;
const PIG_COUNT = Math.floor(TREE_COUNT / 10);
const HIPPO_COUNT = 0;
const BEAR_COUNT = 1;
const LEVEL_BOSS_COUNT = 1;

// Global variables for our application
let playerCustomizer;

let spacePressed = false;

const forestSound = new Audio('./assets/soundfx/forest.mp3');
forestSound.loop = true;
forestSound.volume = 0.25;

const loadingManager = new THREE.LoadingManager();
let totalItems = 0;
let loadedItems = 0;

loadingManager.onStart = function(url, itemsLoaded, itemsTotal) {
    totalItems = itemsTotal;
    console.log('Started loading: ' + url);
};

loadingManager.onProgress = function(url, itemsLoaded, itemsTotal) {
    loadedItems = itemsLoaded;
    const progress = Math.round((itemsLoaded / itemsTotal) * 100);
    updateLoadingProgress(progress);
    console.log('Loading file: ' + url + ' (' + itemsLoaded + '/' + itemsTotal + ')');
};

loadingManager.onLoad = function() {
    console.log('Loading complete!');
    enablePlayButton();
};

loadingManager.onError = function(url) {
    console.error('Error loading: ' + url);
};

function updateLoadingProgress(percent) {
    const progressBar = document.getElementById('loadingProgress');
    const loadingText = document.getElementById('loadingText');
    
    if (progressBar && loadingText) {
        progressBar.style.width = percent + '%';
        loadingText.textContent = 'Loading: ' + percent + '%';
    }
}

function enablePlayButton() {
    const playButton = document.getElementById('playButton');
    if (playButton) {
        playButton.disabled = false;
        playButton.textContent = 'Start Game';
        loadingText.textContent = 'Ready to Play!';
    }
}

function startGame() {
    forestSound.play().catch(error => {
        console.error('Error playing forest sound:', error);
    });
    
    document.getElementById('startScreen').style.display = 'none';
    animate();
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);
    
    camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 10000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    
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
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 50;
    controls.maxDistance = 500;
    controls.maxPolarAngle = Math.PI / 2 - 0.1;
    
    createSky();
    createLighting();
    
    const terrainResult = createTerrain(scene, TERRAIN_SIZE, TERRAIN_SEGMENTS, WATER_LEVEL);
    terrain = terrainResult.terrain;
    terrainGeometry = terrainResult.geometry;
    
    createWater();
    
    house = createHouse(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    trees = createTrees(scene, terrain, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, TREE_COUNT);
    clouds = createClouds(scene, TERRAIN_SIZE, CLOUD_COUNT);
    birds = createBirds(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, BIRD_COUNT);
    pigs = createPigs(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, PIG_COUNT);
    sharks = createSharks(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, SHARK_COUNT);
    hippos = createHippos(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, HIPPO_COUNT);    
    bears = createBears(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, BEAR_COUNT);
    
    createLevelBoss(scene, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, null, LEVEL_BOSS_COUNT)
        .then(boss => {
            levelBoss = boss;
            console.log('Level boss created successfully');
        })
        .catch(error => {
            console.error('Error creating level boss:', error);
        });
    
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    setupPlayer();
    setupEventListeners();
    createCrosshair();
    
    console.log("WASD or Arrow Keys to move, Space to jump");
    console.log("Click anywhere to enter first-person mode, ESC to exit");
    
    // Initialize stone geometry and material
    stoneGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    stoneMaterial = new THREE.MeshBasicMaterial({ color: 0xFF8C00 }); //orange for testing
}

function setupPlayer() {
    const houseX = -TERRAIN_SIZE * 0.4;
    const houseZ = -TERRAIN_SIZE * 0.4;
    const houseY = getTerrainHeight(houseX, houseZ) + 10;

    fpControls = new PointerLockControls(camera, document.body);
    scene.add(fpControls.getObject());
    
    camera.position.set(houseX + 20, houseY + 24, houseZ + 20);
    fpControls.getObject().position.set(houseX + 20, houseY + 24, houseZ + 20);
    
    const loader = new GLTFLoader();
    const flyingSquirrelModel = './assets/flying-squirrel.glb';
    const regularSquirrelModel = './assets/squirrel.glb';
    
    loader.load(player.isJumping ? flyingSquirrelModel : regularSquirrelModel, (gltf) => {
        console.log("Squirrel model loaded successfully", gltf);
        player.model = gltf.scene;
        scene.add(player.model);
        player.model.scale.set(8, 8, 8);
        player.model.position.set(houseX + 20, houseY + 10, houseZ + 20);
        createPlayerShadow();
        playerCustomizer = new PlayerCustomizer(scene, player);
        
        // Preload both squirrel models
        preloadSquirrelModels();
    });
    
    // **Modified: Click event now triggers shooting when locked**
    document.addEventListener('click', function(event) {
        if (event.target.closest('#player-customizer') || 
            event.target.closest('.action-button') ||
            event.target.closest('.lightbox')) {
            return;
        }
        
        if (isLocked) {
            shootStone();
        } else {
            console.log("Click detected, locking pointer");
            fpControls.lock();
        }
    });
    
    fpControls.addEventListener('lock', function() {
        isLocked = true;
        console.log("Pointer lock enabled - third person active");
        if (crosshair) crosshair.style.opacity = '1';
        const camera = fpControls.getObject();
        const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
        player.lastGroundY = terrainY;
        camera.position.y = terrainY + 40;
        if (controls) controls.enabled = false;
    });
    
    fpControls.addEventListener('unlock', function() {
        isLocked = false;
        console.log("Pointer lock disabled - returning to orbit mode");
        if (crosshair) crosshair.style.opacity = '0';
        if (controls) controls.enabled = true;
    });
}

// Preload both squirrel models for quick swapping
function preloadSquirrelModels() {
    const loader = new GLTFLoader();
    
    // Load flying squirrel model
    loader.load('./assets/flying-squirrel.glb', (gltf) => {
        player.flyingModel = gltf.scene;
        player.flyingModel.visible = false;
        player.flyingModel.scale.set(10, 8, 10);
        scene.add(player.flyingModel);
        
        // Copy position from main model if available
        if (player.model) {
            player.flyingModel.position.copy(player.model.position);
            player.flyingModel.rotation.copy(player.model.rotation);
        }
        console.log("Flying squirrel model preloaded");
    });
    
    // Load regular squirrel model
    loader.load('./assets/squirrel.glb', (gltf) => {
        player.regularModel = gltf.scene;
        // Make this visible as it's the default
        player.regularModel.visible = true;
        player.regularModel.scale.set(8, 8, 8);
        scene.add(player.regularModel);
        
        // Copy position from main model if available
        if (player.model) {
            player.regularModel.position.copy(player.model.position);
            player.regularModel.rotation.copy(player.model.rotation);
            
            // Set the regular model as the player model
            // and remove the original model which is redundant now
            scene.remove(player.model);
            player.model = player.regularModel;
        }
        console.log("Regular squirrel model preloaded");
    });
}

// Function to swap between regular and flying squirrel models
function swapSquirrelModel(isFlying) {
    if (!player.flyingModel || !player.regularModel) {
        console.log("Models not yet loaded, can't swap");
        return;
    }
    
    // Get current position and rotation from current model
    const currentModel = player.model;
    if (!currentModel) {
        console.log("No current model to swap from");
        return;
    }
    
    // Update positions of both models to current position
    const targetModel = isFlying ? player.flyingModel : player.regularModel;
    
    targetModel.position.copy(currentModel.position);
    targetModel.rotation.copy(currentModel.rotation);
    
    // Switch visibility
    currentModel.visible = false;
    targetModel.visible = true;
    
    // Update the player.model reference
    player.model = targetModel;
    
    console.log(`Swapped to ${isFlying ? 'flying' : 'regular'} squirrel model`);
    
    // Update shadow
    updatePlayerShadow();
}

function createPlayerShadow() {
    const shadowRadius = 3;
    const shadowGeometry = new THREE.CircleGeometry(shadowRadius, 100);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shadowTexture = new THREE.CanvasTexture(canvas);
    const shadowMaterial = new THREE.MeshBasicMaterial({
        map: shadowTexture,
        transparent: true,
        depthWrite: false
    });
    player.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    player.shadow.rotation.x = -Math.PI / 2;
    player.shadow.position.set(0, 0.1, 0);
    scene.add(player.shadow);
    console.log("Player shadow created with gradient texture");
}

function updatePlayerShadow() {
    if (!player.model || !player.shadow) return;
    const modelX = player.model.position.x;
    const modelZ = player.model.position.z;
    const terrainY = getTerrainHeight(modelX, modelZ);
    const shadowY = Math.max(terrainY, WATER_LEVEL) + 0.8;
    player.shadow.position.x = modelX;
    player.shadow.position.z = modelZ;
    player.shadow.position.y = shadowY;
    const heightAboveGround = player.model.position.y - shadowY;
    const scaleBase = 1.0;
    const scaleReduction = heightAboveGround / 50;
    const shadowScale = Math.max(0.5, scaleBase - scaleReduction);
    player.shadow.scale.set(shadowScale, shadowScale, shadowScale);
    const opacityBase = 0.6;
    const opacityReduction = heightAboveGround / 60;
    player.shadow.material.opacity = Math.max(0.1, opacityBase - opacityReduction);
}

function setupEventListeners() {
    document.addEventListener('keydown', function(event) {
        console.log("Key pressed:", event.code);
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
                if (!spacePressed && !player.isJumping && player.model) {
                    spacePressed = true;
                    player.isJumping = true;
                    player.model.position.y += player.jumpHeight;
                    console.log("JUMP! Starting Y:", player.model.position.y);
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
                spacePressed = false;
                break;
        }
    });
    
    document.getElementById('open-customizer').addEventListener('click', () => {
        if (playerCustomizer) {
            playerCustomizer.toggle();
        }
    });
}

function createLighting() {
    directionalLight = new THREE.DirectionalLight(0xfffafa, 1.2);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 800;
    const shadowSize = TERRAIN_SIZE / 1.8;
    directionalLight.shadow.camera.left = -shadowSize;
    directionalLight.shadow.camera.right = shadowSize;
    directionalLight.shadow.camera.top = shadowSize;
    directionalLight.shadow.camera.bottom = -shadowSize;
    directionalLight.shadow.bias = -0.0005;
    directionalLight.shadow.normalBias = 0.02;
    scene.add(directionalLight);
    
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
    hemiLight.position.set(0, 300, 0);
    scene.add(hemiLight);
    
    const pointLight1 = new THREE.PointLight(0xff7e47, 0.5, 250);
    pointLight1.position.set(100, 50, 100);
    scene.add(pointLight1);
    
    const pointLight2 = new THREE.PointLight(0x4ca7ff, 0.3, 250);
    pointLight2.position.set(-100, 50, -100);
    scene.add(pointLight2);
}

function createSky() {
    sky = new Sky();
    sky.scale.setScalar(10000);
    scene.add(sky);
    
    sun = new THREE.Vector3();
    
    const skyParams = {
        turbidity: 8,
        rayleigh: 1.5,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.9,
        elevation: 30,
        azimuth: 180,
        exposure: renderer.toneMappingExposure
    };
    
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    function updateSun() {
        const phi = THREE.MathUtils.degToRad(90 - skyParams.elevation);
        const theta = THREE.MathUtils.degToRad(skyParams.azimuth);
        sun.setFromSphericalCoords(1, phi, theta);
        sky.material.uniforms['sunPosition'].value.copy(sun);
        if (water) {
            water.material.uniforms['sunDirection'].value.copy(sun).normalize();
        }
        if (directionalLight) {
            directionalLight.position.set(sun.x * 100, sun.y * 100, sun.z * 100);
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
    water.position.y = WATER_LEVEL + 12;
    water.material.side = THREE.DoubleSide;
    scene.add(water);
}

function getTerrainHeight(x, z) {
    if (!terrainGeometry) return 0;
    try {
        const raycaster = new THREE.Raycaster();
        raycaster.set(new THREE.Vector3(x, 1000, z), new THREE.Vector3(0, -1, 0));
        const intersects = raycaster.intersectObject(terrain);
        if (intersects.length > 0) return intersects[0].point.y;
        const terrainSize = TERRAIN_SIZE;
        const segments = TERRAIN_SEGMENTS;
        const halfSize = terrainSize / 2;
        const xIndex = Math.floor(((x + halfSize) / terrainSize) * segments);
        const zIndex = Math.floor(((z + halfSize) / terrainSize) * segments);
        if (xIndex >= 0 && xIndex <= segments && zIndex >= 0 && zIndex <= segments) {
            const vertexIndex = (zIndex * (segments + 1) + xIndex) * 3 + 1;
            if (terrainGeometry.attributes && terrainGeometry.attributes.position) {
                return terrainGeometry.attributes.position.array[vertexIndex];
            }
        }
    } catch (error) {
        console.warn("Error getting terrain height:", error);
    }
    return player.lastGroundY > 0 ? player.lastGroundY : 0;
}

function shootStone() {
    const currentTime = clock.getElapsedTime();
    if (currentTime - lastShotTime < SHOT_COOLDOWN) return;
    lastShotTime = currentTime;
    
    // Create stone
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    
    // Position stone in front of camera
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    stone.position.copy(camera.position);
    stone.position.add(forward.multiplyScalar(10)); // Offset to avoid camera clipping
    
    // Set velocity (40 units per second in camera direction)
    stone.velocity = forward.multiplyScalar(60);
    
    // Add slight upward trajectory
    stone.velocity.y += 8;
    
    // Track creation time for lifetime
    stone.creationTime = currentTime;
    
    // Add to scene and tracking array
    scene.add(stone);
    stones.push(stone);
}

function animate() {
    requestAnimationFrame(animate);
    const time = clock.getElapsedTime();
    const delta = clock.getDelta();
    
    if (isLocked) {
        const speed = player.speed;
        const camera = fpControls.getObject();
        const prevX = camera.position.x;
        const prevZ = camera.position.z;
        
        if (moveForward) fpControls.moveForward(speed);
        if (moveBackward) fpControls.moveForward(-speed);
        if (moveLeft) fpControls.moveRight(-speed);
        if (moveRight) fpControls.moveRight(speed);
        
        const terrainY = getTerrainHeight(camera.position.x, camera.position.z);
        player.lastGroundY = terrainY;
        const baseHeight = Math.max(terrainY, WATER_LEVEL + 0.5) + player.height + 5;
        
        if (player.isJumping && player.model) {
            camera.position.y = player.model.position.y;
        } else {
            camera.position.y = baseHeight + 5;
        }
        
        const underwaterOverlay = document.getElementById('underwater-overlay');
        if (terrainY < 0.5) {
            if (underwaterOverlay) underwaterOverlay.style.opacity = '0.5';
        } else {
            if (underwaterOverlay) underwaterOverlay.style.opacity = '0';
        }
        
        if (player.model) {
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const modelDistance = 15;
            const modelX = camera.position.x + direction.x * modelDistance;
            const modelZ = camera.position.z + direction.z * modelDistance;
            const modelTerrainY = getTerrainHeight(modelX, modelZ);
            const modelMinHeight = Math.max(modelTerrainY, WATER_LEVEL + 0.5);
            player.model.position.x = modelX;
            player.model.position.z = modelZ;
            
            if (player.isJumping) {
                player.model.position.y -= 2;
                if (player.model.position.y <= modelMinHeight + player.modelBaseHeight) {
                    player.isJumping = false;
                    player.model.position.y = modelMinHeight + player.modelBaseHeight + 2;
                    console.log("Landed!");
                    swapSquirrelModel(false);
                }
            } else {
                player.model.position.y = modelMinHeight + player.modelBaseHeight + 2;
            }
            
            if (prevX !== camera.position.x || prevZ !== camera.position.z) {
                const angle = Math.atan2(camera.position.x - prevX, camera.position.z - prevZ);
                player.model.rotation.y = angle;
            }
        }
    } else {
        if (controls) controls.update();
    }
    
    if (water) water.material.uniforms['time'].value = time;
    
    scene.traverse(function(object) {
        if (object.isMesh && object.material.type === 'ShaderMaterial' && object.material.uniforms && object.material.uniforms.time) {
            object.material.uniforms.time.value = time;
        }
    });
    
    updateClouds(clouds, time, delta, TERRAIN_SIZE);
    updateBirds(birds, time, delta);
    updatePigs(pigs, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    updateSharks(sharks, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    updateHippos(hippos, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight);
    updateBears(bears, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, camera.position);
    updateLevelBoss(levelBoss, time, delta, TERRAIN_SIZE, WATER_LEVEL, getTerrainHeight, camera.position);
    updatePlayerShadow();
    
    if (isLocked && fpControls) {
        const compassArrow = document.getElementById('compass-arrow');
        if (compassArrow) {
            const camera = fpControls.getObject();
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            const angle = -Math.atan2(direction.x, direction.z) * (180 / Math.PI);
            compassArrow.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        }
    }
    
    updateHouse(house, time, delta);
    
    // Update stones
    for (let i = stones.length - 1; i >= 0; i--) {
        const stone = stones[i];
        
        // Remove old stones (after 3 seconds)
        if (time - stone.creationTime > 3) {
            scene.remove(stone);
            stones.splice(i, 1);
            continue;
        }
        
        // Calculate time delta for this frame
        const delta = clock.getDelta();
        
        // Apply gravity
        stone.velocity.y -= 9.8 * delta;
        
        // Move stone based on velocity
        stone.position.x += stone.velocity.x * delta;
        stone.position.y += stone.velocity.y * delta;
        stone.position.z += stone.velocity.z * delta;
        
        // Check for terrain collision
        const terrainY = getTerrainHeight(stone.position.x, stone.position.z);
        if (stone.position.y <= terrainY + 0.5) {
            scene.remove(stone);
            stones.splice(i, 1);
        }
    }
    
    renderer.render(scene, camera);
}

function createCrosshair() {
    crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.position = 'absolute';
    crosshair.style.top = 'calc(50% - 5px)';
    crosshair.style.left = '50%';
    crosshair.style.width = '70px';
    crosshair.style.height = '70px';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.opacity = '0';
    
    const verticalLine = document.createElement('div');
    verticalLine.style.position = 'absolute';
    verticalLine.style.top = '0';
    verticalLine.style.left = '50%';
    verticalLine.style.width = '1px';
    verticalLine.style.height = '100%';
    verticalLine.style.backgroundColor = 'black';
    verticalLine.style.transform = 'translateX(-50%)';
    
    const horizontalLine = document.createElement('div');
    horizontalLine.style.position = 'absolute';
    horizontalLine.style.top = '50%';
    horizontalLine.style.left = '0';
    horizontalLine.style.width = '100%';
    horizontalLine.style.height = '1px';
    horizontalLine.style.backgroundColor = 'black';
    horizontalLine.style.transform = 'translateY(-50%)'; 

    crosshair.appendChild(verticalLine);
    crosshair.appendChild(horizontalLine);
    document.body.appendChild(crosshair);
}

document.addEventListener('DOMContentLoaded', () => {
    const playButton = document.getElementById('playButton');
    if (playButton) {
        playButton.addEventListener('click', startGame);
    }
    init();
    renderer.render(scene, camera);
});