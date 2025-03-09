import { MultiplayerClient } from './multiplayer-client.js';

// Initialize multiplayer
let multiplayerClient;

function initMultiplayer() {
    // Create multiplayer client
    multiplayerClient = new MultiplayerClient(scene);
    
    // Connect to server
    multiplayerClient.connect();
    
    console.log("Multiplayer initialized");
}

// Call after scene setup
initMultiplayer();

// Inside animate() or your game loop:
function updateMultiplayer() {
    // Only update if player exists
    if (player && player.model) {
        // Send player position and rotation to server
        multiplayerClient.updatePosition(
            player.model.position,
            player.model.rotation
        );
    }
}

// Call inside your animation loop
updateMultiplayer(); 