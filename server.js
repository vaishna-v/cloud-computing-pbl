// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Store active games
const activeGames = new Map();

// Generate unique room ID
function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a room
    socket.on('join-room', (roomId, gameType) => {
        // If room doesn't exist, create it
        if (!activeGames.has(roomId)) {
            activeGames.set(roomId, {
                gameType: gameType,
                players: [],
                gameState: initializeGameState(gameType),
                currentPlayer: 'X'
            });
        }

        const game = activeGames.get(roomId);
        
        // Add player to room (max 2 players)
        if (game.players.length < 2) {
            game.players.push(socket.id);
            socket.join(roomId);
            
            // Assign player symbol (X goes first, O second)
            const playerSymbol = game.players.length === 1 ? 'X' : 'O';
            socket.emit('player-assigned', playerSymbol);
            
            // Notify both players about room status
            io.to(roomId).emit('player-joined', {
                playerCount: game.players.length,
                currentPlayer: game.currentPlayer
            });

            console.log(`Player ${socket.id} joined room ${roomId} as ${playerSymbol}`);
        } else {
            socket.emit('room-full');
        }
    });

    // Handle game moves
    socket.on('make-move', (data) => {
        const { roomId, position, player } = data;
        const game = activeGames.get(roomId);

        if (!game || game.players.length !== 2) return;

        // Validate move
        if (player !== game.currentPlayer) return;
        if (!isValidMove(game.gameState, position, game.gameType)) return;

        // Update game state
        updateGameState(game.gameState, position, player, game.gameType);
        
        // Check for win or draw
        const gameResult = checkGameResult(game.gameState, game.gameType);
        
        // Switch player
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';

        // Broadcast move to all players in room
        io.to(roomId).emit('move-made', {
            position: position,
            player: player,
            gameState: game.gameState,
            currentPlayer: game.currentPlayer,
            gameResult: gameResult
        });

        // Clean up room if game is over
        if (gameResult.gameOver) {
            setTimeout(() => {
                activeGames.delete(roomId);
                io.to(roomId).emit('room-closed');
            }, 30000); // Clean up after 30 seconds
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Remove player from all games
        for (const [roomId, game] of activeGames.entries()) {
            const playerIndex = game.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                
                // Notify other player
                socket.to(roomId).emit('player-left');
                
                // Clean up empty rooms after a delay
                if (game.players.length === 0) {
                    setTimeout(() => {
                        if (activeGames.get(roomId)?.players.length === 0) {
                            activeGames.delete(roomId);
                        }
                    }, 60000); // Clean up after 1 minute
                }
            }
        }
    });
});

// Game state management functions
function initializeGameState(gameType) {
    if (gameType === 'tictactoe') {
        return Array(9).fill(null);
    } 
}

function isValidMove(gameState, position, gameType) {
    if (gameType === 'tictactoe') {
        return position >= 0 && position < 9 && gameState[position] === null;
    } 
    return false;
}


function updateGameState(gameState, position, player, gameType) {
    if (gameType === 'tictactoe') {
        gameState[position] = player;
    } 
}


function checkGameResult(gameState, gameType) {
    if (gameType === 'tictactoe') {
        const winningCombinations = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const combo of winningCombinations) {
            const [a, b, c] = combo;
            if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c]) {
                return { gameOver: true, winner: gameState[a], draw: false };
            }
        }

        if (gameState.every(cell => cell !== null)) {
            return { gameOver: true, winner: null, draw: true };
        }

        return { gameOver: false, winner: null, draw: false };
    }
    
    return { gameOver: false, winner: null, draw: false };
}

// Add this helper function
function isBoardFull(board) {
    return board.every(cell => cell !== null);
}

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/about.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/games/tictactoe.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'games', 'tictactoe.html'));
});

app.get('/games/supertictactoe.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'games', 'supertictactoe.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});