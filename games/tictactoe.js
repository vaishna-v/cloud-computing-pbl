// games/tictactoe.js

// Get room ID from URL or generate new one
function getRoomId() {
    const urlParams = new URLSearchParams(window.location.search);
    let roomId = urlParams.get('room');
    
    if (!roomId) {
        roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.history.replaceState({}, '', `?room=${roomId}`);
    }
    
    return roomId;
}

// Initialize game
document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const roomId = getRoomId();
    let playerSymbol = null;
    let currentPlayer = 'X';
    let gameBoard = Array(9).fill(null);
    let gameActive = false;

    // Display room ID
    document.getElementById('roomId').textContent = roomId;

    // Create game board
    const gameBoardElement = document.getElementById('gameBoard');
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.index = i;
        cell.addEventListener('click', () => handleCellClick(i));
        gameBoardElement.appendChild(cell);
    }

    // Join room
    socket.emit('join-room', roomId, 'tictactoe');

    // Socket event handlers
    socket.on('player-assigned', (symbol) => {
        playerSymbol = symbol;
        updateGameStatus();
    });

    socket.on('player-joined', (data) => {
        if (data.playerCount === 2) {
            gameActive = true;
            updateGameStatus();
        } else {
            updateGameStatus('Waiting for opponent...');
        }
    });

    socket.on('move-made', (data) => {
        gameBoard = data.gameState;
        currentPlayer = data.currentPlayer;
        updateBoard();
        updateGameStatus();

        if (data.gameResult.gameOver) {
            gameActive = false;
            showGameResult(data.gameResult);
        }
    });

    socket.on('player-left', () => {
        gameActive = false;
        updateGameStatus('Opponent left the game');
    });

    socket.on('room-full', () => {
        updateGameStatus('Room is full. Please create a new game.');
    });

    // Game functions
    function handleCellClick(index) {
        if (!gameActive || gameBoard[index] !== null || playerSymbol !== currentPlayer) {
            return;
        }

        socket.emit('make-move', {
            roomId: roomId,
            position: index,
            player: playerSymbol
        });
    }

    function updateBoard() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach((cell, index) => {
            cell.textContent = gameBoard[index] || '';
            cell.className = 'cell';
            if (gameBoard[index]) {
                cell.classList.add(gameBoard[index].toLowerCase());
            }
        });
    }

    function updateGameStatus(customMessage) {
        const statusElement = document.getElementById('gameStatus');
        
        if (customMessage) {
            statusElement.innerHTML = customMessage;
            return;
        }

        if (!gameActive) {
            if (playerSymbol) {
                statusElement.innerHTML = 'Waiting for opponent to join...';
            } else {
                statusElement.innerHTML = 'Connecting to game...';
            }
        } else {
            if (playerSymbol === currentPlayer) {
                statusElement.innerHTML = `Your turn (<span class="current-player">${playerSymbol}</span>)`;
            } else {
                statusElement.innerHTML = `Opponent's turn (<span class="current-player">${currentPlayer}</span>)`;
            }
        }
    }

    function showGameResult(result) {
        const statusElement = document.getElementById('gameStatus');
        
        if (result.draw) {
            statusElement.innerHTML = '<div class="draw-message">Game ended in a draw!</div>';
        } else if (result.winner === playerSymbol) {
            statusElement.innerHTML = '<div class="winner-message">You won!</div>';
        } else {
            statusElement.innerHTML = '<div class="winner-message">You lost!</div>';
        }

        // Highlight winning cells if applicable
        if (!result.draw) {
            highlightWinningCells();
        }
    }

    function highlightWinningCells() {
        // This would be implemented based on the winning combination
        // For now, we'll just mark all cells as non-interactive
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.cursor = 'default';
        });
    }

    // Initialize board
    updateBoard();
    updateGameStatus();
});

