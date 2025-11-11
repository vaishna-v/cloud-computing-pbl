// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameHandler = require('./gameHandler');  // ← THIS LINE WAS MISSING

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize game handler
const gameHandler = new GameHandler();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a room
    socket.on('join-room', (roomId, gameType) => {
        const result = gameHandler.joinRoom(roomId, gameType, socket.id);
        
        if (result.success) {
            socket.join(roomId);
            socket.emit('player-assigned', result.playerSymbol);
            
            io.to(roomId).emit('player-joined', {
                playerCount: result.playerCount,
                currentPlayer: result.currentPlayer
            });

            console.log(`Player ${socket.id} joined room ${roomId} as ${result.playerSymbol}`);
        } else {
            socket.emit('room-full');
        }
    });

    // Handle game moves
    socket.on('make-move', (data) => {
        const { roomId, position, player } = data;
        const result = gameHandler.makeMove(roomId, position, player);
        
        if (result.success) {
            io.to(roomId).emit('move-made', {
                position: position,
                player: player,
                gameState: result.gameState,
                currentPlayer: result.currentPlayer,
                gameResult: result.gameResult
            });

            // Clean up room if game is over
            if (result.gameResult.gameOver) {
                setTimeout(() => {
                    gameHandler.cleanupRoom(roomId);
                }, 30000);
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        gameHandler.handleDisconnect(socket.id);
    });
});

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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});