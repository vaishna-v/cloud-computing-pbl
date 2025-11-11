// games/connectfour.js

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
    let currentPlayer = 'R';
    let gameBoard = initializeGameState();
    let gameActive = false;

    // Display room ID
    document.getElementById('roomId').textContent = roomId;

    // Create game board
    const gameBoardElement = document.getElementById('gameBoard');
    const columnHeaderElement = document.getElementById('columnHeader');
    createGameBoard(gameBoardElement, columnHeaderElement);

    // Join room
    socket.emit('join-room', roomId, 'connectfour');

    // Socket event handlers
    socket.on('player-assigned', (symbol) => {
        playerSymbol = symbol;
        updateGameStatus();
        updatePlayerIndicator();
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
    function initializeGameState() {
        // 6 rows x 7 columns
        return Array(6).fill(null).map(() => Array(7).fill(null));
    }

    function createGameBoard(boardElement, headerElement) {
        // Clear existing elements
        boardElement.innerHTML = '';
        headerElement.innerHTML = '';

        // Create column buttons
        for (let col = 0; col < 7; col++) {
            const columnButton = document.createElement('div');
            columnButton.className = 'column-button';
            columnButton.textContent = col + 1;
            columnButton.dataset.column = col;
            columnButton.addEventListener('click', () => handleColumnClick(col));
            headerElement.appendChild(columnButton);
        }

        // Create board cells
        for (let row = 0; row < 6; row++) {
            const boardRow = document.createElement('div');
            boardRow.className = 'board-row';
            
            for (let col = 0; col < 7; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell empty';
                cell.dataset.row = row;
                cell.dataset.column = col;
                boardRow.appendChild(cell);
            }
            
            boardElement.appendChild(boardRow);
        }
    }

    function handleColumnClick(column) {
        if (!gameActive || playerSymbol !== currentPlayer) return;

        socket.emit('make-move', {
            roomId: roomId,
            position: column, // In Connect Four, position is just the column number
            player: playerSymbol
        });
    }

    function updateBoard() {
        // Update all cells
        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const cell = document.querySelector(`.cell[data-row="${row}"][data-column="${col}"]`);
                const value = gameBoard[row][col];
                
                cell.className = 'cell';
                if (value === null) {
                    cell.classList.add('empty');
                } else if (value === 'R') {
                    cell.classList.add('red');
                } else if (value === 'Y') {
                    cell.classList.add('yellow');
                }
            }
        }
    }

    function updatePlayerIndicator() {
        const playerIndicators = document.querySelectorAll('.player-indicator div');
        if (playerSymbol === 'R') {
            playerIndicators[0].innerHTML = '<div class="player-color player-red"></div><span>Red (You)</span>';
            playerIndicators[1].innerHTML = '<div class="player-color player-yellow"></div><span>Yellow (Opponent)</span>';
        } else {
            playerIndicators[0].innerHTML = '<div class="player-color player-red"></div><span>Red (Opponent)</span>';
            playerIndicators[1].innerHTML = '<div class="player-color player-yellow"></div><span>Yellow (You)</span>';
        }
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
            const playerName = currentPlayer === 'R' ? 'Red' : 'Yellow';
            if (playerSymbol === currentPlayer) {
                statusElement.innerHTML = `Your turn (<span class="current-player">${playerName}</span>)`;
            } else {
                statusElement.innerHTML = `Opponent's turn (<span class="current-player">${playerName}</span>)`;
            }
        }
    }

    function showGameResult(result) {
        const statusElement = document.getElementById('gameStatus');
        
        if (result.draw) {
            statusElement.innerHTML = '<div class="draw-message">Game ended in a draw!</div>';
        } else if (result.winner === playerSymbol) {
            const winnerName = result.winner === 'R' ? 'Red' : 'Yellow';
            statusElement.innerHTML = `<div class="winner-message">You won as ${winnerName}!</div>`;
        } else {
            const winnerName = result.winner === 'R' ? 'Red' : 'Yellow';
            statusElement.innerHTML = `<div class="winner-message">You lost! ${winnerName} won!</div>`;
        }

        // Disable all column buttons
        const columnButtons = document.querySelectorAll('.column-button');
        columnButtons.forEach(button => {
            button.style.cursor = 'default';
            button.style.opacity = '0.5';
        });
    }

    // Initialize board
    updateBoard();
    updateGameStatus();
});