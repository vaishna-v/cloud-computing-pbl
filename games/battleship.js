// games/battleship.js

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
    let currentPlayer = 'P1';
    let gameState = null;
    let gameActive = false;

    // Display room ID
    document.getElementById('roomId').textContent = roomId;

    // Create game boards
    createGameBoards();

    // Join room
    socket.emit('join-room', roomId, 'battleship');

    // Socket event handlers
    socket.on('player-assigned', (symbol) => {
        playerSymbol = symbol;
        updateGameStatus();
        updateBoardTitles();
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
        gameState = data.gameState;
        currentPlayer = data.currentPlayer;
        updateBoards();
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
    function createGameBoards() {
        createBoard('yourBoard', 'yourCoordinatesRow', 'yourRowCoordinates', false);
        createBoard('opponentBoard', 'opponentCoordinatesRow', 'opponentRowCoordinates', true);
    }

    function createBoard(boardId, coordsRowId, rowCoordsId, isClickable) {
        const boardElement = document.getElementById(boardId);
        const coordsRowElement = document.getElementById(coordsRowId);
        const rowCoordsElement = document.getElementById(rowCoordsId);
        
        // Clear existing elements
        boardElement.innerHTML = '';
        coordsRowElement.innerHTML = '';
        rowCoordsElement.innerHTML = '';

        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

        // Create top coordinates (numbers 1-10)
        for (let col = 1; col <= 10; col++) {
            const coord = document.createElement('div');
            coord.className = 'coordinate';
            coord.textContent = col;
            coordsRowElement.appendChild(coord);
        }

        // Create row coordinates (letters A-J) and grid cells
        for (let row = 0; row < 10; row++) {
            // Row coordinate
            const rowCoord = document.createElement('div');
            rowCoord.className = 'row-coordinate';
            rowCoord.textContent = letters[row];
            rowCoordsElement.appendChild(rowCoord);

            // Grid row
            const gridRow = document.createElement('div');
            gridRow.className = 'grid-row';
            
            // Game cells
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell empty';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                if (isClickable && boardId === 'opponentBoard') {
                    cell.addEventListener('click', () => handleAttack(row, col));
                }
                
                gridRow.appendChild(cell);
            }
            boardElement.appendChild(gridRow);
        }
    }

    function handleAttack(row, col) {
        if (!gameActive || playerSymbol !== currentPlayer) return;

        socket.emit('make-move', {
            roomId: roomId,
            position: [row, col],
            player: playerSymbol
        });
    }

    function updateBoards() {
        if (!gameState) return;

        // Update your board (show your ships and opponent's attacks)
        updatePlayerBoard('yourBoard', playerSymbol, true);
        
        // Update opponent's board (show your attacks)
        updatePlayerBoard('opponentBoard', playerSymbol === 'P1' ? 'P2' : 'P1', false);
    }

    function updatePlayerBoard(boardId, targetPlayer, showShips) {
        const boardElement = document.getElementById(boardId);
        const cells = boardElement.querySelectorAll('.grid-cell');

        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            
            cell.className = 'grid-cell';
            
            // Check if this cell has been attacked
            const isAttacked = gameState.attacks[targetPlayer][row][col];
            const hasShip = gameState.ships[targetPlayer].some(ship => 
                ship.positions.some(pos => pos[0] === row && pos[1] === col)
            );

            if (isAttacked) {
                if (hasShip) {
                    cell.classList.add('hit');
                } else {
                    cell.classList.add('miss');
                }
            } else if (showShips && hasShip) {
                cell.classList.add('ship');
            } else {
                cell.classList.add('empty');
            }

            // Disable opponent's board cells when it's not your turn
            if (boardId === 'opponentBoard' && (!gameActive || playerSymbol !== currentPlayer)) {
                cell.classList.add('disabled');
            }
        });
    }

    function updateBoardTitles() {
        const yourBoardTitle = document.getElementById('yourBoardTitle');
        const opponentBoardTitle = document.getElementById('opponentBoardTitle');
        
        if (playerSymbol === 'P1') {
            yourBoardTitle.textContent = 'Player 1 - Your Ships';
            opponentBoardTitle.textContent = 'Player 2 - Attack Here';
        } else {
            yourBoardTitle.textContent = 'Player 2 - Your Ships';
            opponentBoardTitle.textContent = 'Player 1 - Attack Here';
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
            const playerName = currentPlayer === 'P1' ? 'Player 1' : 'Player 2';
            if (playerSymbol === currentPlayer) {
                statusElement.innerHTML = `Your turn! Attack opponent (<span class="current-player">${playerName}</span>)`;
            } else {
                statusElement.innerHTML = `Opponent's turn (<span class="current-player">${playerName}</span>)`;
            }
        }
    }

    function showGameResult(result) {
        const statusElement = document.getElementById('gameStatus');
        
        if (result.winner === playerSymbol) {
            statusElement.innerHTML = '<div class="winner-message">Victory! You sank all enemy ships! 🎉</div>';
        } else {
            statusElement.innerHTML = '<div class="winner-message">Defeat! Your fleet was destroyed! 💥</div>';
        }

        // Disable all opponent board cells
        const opponentCells = document.querySelectorAll('#opponentBoard .grid-cell');
        opponentCells.forEach(cell => {
            cell.classList.add('disabled');
        });
    }

    // Initialize boards
    updateGameStatus();
});