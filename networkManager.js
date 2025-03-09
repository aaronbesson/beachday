export class NetworkManager {
    constructor(callbacks) {
        this.socket = null;
        this.callbacks = callbacks;
        this.connected = false;
        this.updateInterval = null;
        this.lastUpdate = null;
    }
    
    connect() {
        // Try to close any existing connections first
        if (this.socket && this.socket.readyState !== 3) { // 3 = CLOSED
            this.socket.close();
        }

        // Determine websocket URL (localhost for dev, actual server for prod)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname === 'localhost' ? 
            `${window.location.hostname}:3000` : window.location.host;
        const url = `${protocol}//${host}`;
        
        console.log(`Connecting to WebSocket server at ${url}`);
        
        try {
            this.socket = new WebSocket(url);
            
            this.socket.onopen = () => {
                console.log('Connected to server');
                this.connected = true;
                
                // Start sending regular position updates
                this.startSendingUpdates();
            };
            
            this.socket.onclose = (event) => {
                console.log(`Disconnected from server: ${event.code} ${event.reason}`);
                this.connected = false;
                this.stopSendingUpdates();
                
                // Try to reconnect after delay, but only if not an intentional close
                if (event.code !== 1000) {
                    console.log('Attempting to reconnect in 3 seconds...');
                    setTimeout(() => this.connect(), 3000);
                }
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('Error parsing message:', e, event.data);
                }
            };
        } catch (err) {
            console.error('Error creating WebSocket connection:', err);
            this.connected = false;
            
            // Try to reconnect after delay
            setTimeout(() => this.connect(), 3000);
        }
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'init':
                if (this.callbacks.onInit) {
                    this.callbacks.onInit(message);
                }
                break;
                
            case 'player-joined':
                if (this.callbacks.onPlayerJoined) {
                    this.callbacks.onPlayerJoined(message);
                }
                break;
                
            case 'player-left':
                if (this.callbacks.onPlayerLeft) {
                    this.callbacks.onPlayerLeft(message);
                }
                break;
                
            case 'player-update':
                if (this.callbacks.onPlayerUpdate) {
                    this.callbacks.onPlayerUpdate(message);
                }
                break;
        }
    }
    
    sendUpdate(data) {
        // Throttle updates to not flood the network
        const now = Date.now();
        if (!this.lastUpdate || now - this.lastUpdate > 50) { // Max 20 updates per second
            this.lastUpdate = now;
            this.send('position', data);
        }
    }
    
    sendModelUpdate(modelData) {
        this.send('model-update', { model: modelData });
    }
    
    send(type, data) {
        if (!this.connected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('Cannot send - socket not connected');
            return;
        }
        
        const message = {
            type: type,
            ...data
        };
        
        try {
            this.socket.send(JSON.stringify(message));
        } catch (err) {
            console.error('Error sending message:', err);
        }
    }
    
    startSendingUpdates() {
        // Clear any existing interval
        this.stopSendingUpdates();
        
        // Send updates at regular intervals
        this.updateInterval = setInterval(() => {
            // This is a fallback - most updates will happen in the animation loop
            // based on player movement
        }, 1000); // Low frequency heartbeat just to ensure connection stays alive
    }
    
    stopSendingUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    disconnect() {
        this.stopSendingUpdates();
        if (this.socket) {
            this.socket.close();
        }
    }
}