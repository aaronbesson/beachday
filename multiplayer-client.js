// Simple multiplayer client for Three.js beach game
class MultiplayerClient {
    constructor(scene) {
        this.scene = scene;
        this.playerId = null;
        this.otherPlayers = {}; // Store other players' models
        this.connected = false;
        this.socket = null;
        
        // URL to your WebSocket server
        this.serverUrl = "ws://your-server-url.com"; // Update with your actual server URL
    }
    
    // Connect to the server
    connect() {
        this.socket = new WebSocket(this.serverUrl);
        
        this.socket.onopen = () => {
            console.log("Connected to game server");
            this.connected = true;
        };
        
        this.socket.onclose = () => {
            console.log("Disconnected from game server");
            this.connected = false;
        };
        
        this.socket.onerror = (error) => {
            console.error("WebSocket error:", error);
        };
        
        this.socket.onmessage = (event) => {
            this.handleMessage(JSON.parse(event.data));
        };
    }
    
    // Handle incoming messages
    handleMessage(message) {
        switch (message.type) {
            case 'id':
                // Received our player ID
                this.playerId = message.id;
                console.log("Connected as player", this.playerId);
                break;
                
            case 'new':
                // New player joined
                this.addOtherPlayer(message.id, message.position, message.rotation);
                break;
                
            case 'update':
                // Update another player's position/rotation
                this.updateOtherPlayer(message.id, message.position, message.rotation);
                break;
                
            case 'leave':
                // Another player left
                this.removeOtherPlayer(message.id);
                break;
        }
    }
    
    // Add a new player to the scene
    addOtherPlayer(id, position, rotation) {
        // Create a simple avatar for other players
        // You can replace this with your actual squirrel model later
        const geometry = new THREE.BoxGeometry(3, 6, 3);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const playerMesh = new THREE.Mesh(geometry, material);
        
        // Set position and rotation
        playerMesh.position.set(position.x, position.y, position.z);
        playerMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        
        // Add to scene
        this.scene.add(playerMesh);
        
        // Store reference
        this.otherPlayers[id] = playerMesh;
        
        console.log("Player", id, "joined");
    }
    
    // Update another player's position and rotation
    updateOtherPlayer(id, position, rotation) {
        if (this.otherPlayers[id]) {
            // Update position
            this.otherPlayers[id].position.set(position.x, position.y, position.z);
            
            // Update rotation
            this.otherPlayers[id].rotation.set(rotation.x, rotation.y, rotation.z);
        }
    }
    
    // Remove a player who disconnected
    removeOtherPlayer(id) {
        if (this.otherPlayers[id]) {
            this.scene.remove(this.otherPlayers[id]);
            delete this.otherPlayers[id];
            console.log("Player", id, "left");
        }
    }
    
    // Send our player's position and rotation to server
    updatePosition(position, rotation) {
        if (this.connected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'update',
                position: position,
                rotation: rotation
            }));
        }
    }
    
    // Disconnect from server
    disconnect() {
        if (this.socket) {
            this.socket.close();
        }
    }
}

// Export the class for use in main.js
export { MultiplayerClient }; 