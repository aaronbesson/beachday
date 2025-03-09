// Simple WebSocket server for multiplayer
const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

// Store connected players
const players = {};
let playerIdCounter = 1;

console.log(`WebSocket server started on port ${PORT}`);

// Handle connections
wss.on('connection', (ws) => {
    // Assign unique ID to this connection
    const playerId = playerIdCounter++;
    console.log(`Player ${playerId} connected`);
    
    // Store the player connection
    players[playerId] = {
        ws: ws,
        position: { x: 0, y: 50, z: -10 },
        rotation: { x: 0, y: 0, z: 0 }
    };
    
    // Send this player their ID
    ws.send(JSON.stringify({
        type: 'id',
        id: playerId
    }));
    
    // Inform this player about existing players
    Object.keys(players).forEach(id => {
        if (id != playerId) {
            ws.send(JSON.stringify({
                type: 'new',
                id: id,
                position: players[id].position,
                rotation: players[id].rotation
            }));
        }
    });
    
    // Inform all other players about this new player
    Object.keys(players).forEach(id => {
        if (id != playerId && players[id].ws.readyState === WebSocket.OPEN) {
            players[id].ws.send(JSON.stringify({
                type: 'new',
                id: playerId,
                position: players[playerId].position,
                rotation: players[playerId].rotation
            }));
        }
    });
    
    // Handle messages from this player
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Update player position/rotation
            if (data.type === 'update') {
                players[playerId].position = data.position;
                players[playerId].rotation = data.rotation;
                
                // Broadcast to all other players
                Object.keys(players).forEach(id => {
                    if (id != playerId && players[id].ws.readyState === WebSocket.OPEN) {
                        players[id].ws.send(JSON.stringify({
                            type: 'update',
                            id: playerId,
                            position: data.position,
                            rotation: data.rotation
                        }));
                    }
                });
            }
        } catch (e) {
            console.error("Error processing message:", e);
        }
    });
    
    // Handle disconnection
    ws.on('close', () => {
        console.log(`Player ${playerId} disconnected`);
        
        // Remove this player
        delete players[playerId];
        
        // Inform all other players about disconnection
        Object.keys(players).forEach(id => {
            if (players[id].ws.readyState === WebSocket.OPEN) {
                players[id].ws.send(JSON.stringify({
                    type: 'leave',
                    id: playerId
                }));
            }
        });
    });
}); 