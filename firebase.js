// Firebase configuration and player management
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, remove, push } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Your Firebase configuration (you'll need to add your config)
const firebaseConfig = {
    // Add your Firebase config here
    // apiKey: "your-api-key",
    // authDomain: "your-auth-domain",
    // databaseURL: "your-database-url",
    // projectId: "your-project-id",
    // storageBucket: "your-storage-bucket",
    // messagingSenderId: "your-messaging-sender-id",
    // appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

class MultiplayerManager {
    constructor() {
        this.players = new Map();
        this.currentPlayerId = null;
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onPlayerMoved = null;
        
        // Initialize authentication
        this.initializeAuth();
    }

    async initializeAuth() {
        try {
            const userCredential = await signInAnonymously(auth);
            this.currentPlayerId = userCredential.user.uid;
            this.initializePlayerSync();
        } catch (error) {
            console.error("Auth error:", error);
        }
    }

    initializePlayerSync() {
        // Reference to all players
        const playersRef = ref(db, 'players');

        // Listen for player changes
        onValue(playersRef, (snapshot) => {
            const players = snapshot.val() || {};
            
            // Update local players map
            Object.entries(players).forEach(([playerId, playerData]) => {
                if (!this.players.has(playerId) && playerId !== this.currentPlayerId) {
                    // New player joined
                    this.players.set(playerId, playerData);
                    if (this.onPlayerJoined) {
                        this.onPlayerJoined(playerData);
                    }
                } else if (playerId !== this.currentPlayerId) {
                    // Existing player updated
                    const existingPlayer = this.players.get(playerId);
                    if (JSON.stringify(existingPlayer) !== JSON.stringify(playerData)) {
                        this.players.set(playerId, playerData);
                        if (this.onPlayerMoved) {
                            this.onPlayerMoved(playerData);
                        }
                    }
                }
            });

            // Check for disconnected players
            this.players.forEach((playerData, playerId) => {
                if (!players[playerId]) {
                    this.players.delete(playerId);
                    if (this.onPlayerLeft) {
                        this.onPlayerLeft(playerId);
                    }
                }
            });
        });
    }

    // Add new player
    async addPlayer(playerData) {
        if (!this.currentPlayerId) return;
        
        const playerRef = ref(db, `players/${this.currentPlayerId}`);
        await set(playerRef, {
            id: this.currentPlayerId,
            ...playerData,
            timestamp: Date.now()
        });
    }

    // Update player position and rotation
    async updatePlayer(position, rotation) {
        if (!this.currentPlayerId) return;
        
        const playerRef = ref(db, `players/${this.currentPlayerId}`);
        await set(playerRef, {
            id: this.currentPlayerId,
            position,
            rotation,
            timestamp: Date.now()
        });
    }

    // Remove player on disconnect
    async removePlayer() {
        if (!this.currentPlayerId) return;
        
        const playerRef = ref(db, `players/${this.currentPlayerId}`);
        await remove(playerRef);
    }

    // Clean up on disconnect
    cleanup() {
        this.removePlayer();
    }
}

export const multiplayerManager = new MultiplayerManager(); 