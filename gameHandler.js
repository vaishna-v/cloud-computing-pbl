// gameHandler.js
class GameHandler {
    constructor() {
        this.activeGames = new Map();
    }

    joinRoom(roomId, gameType, socketId) {
        if (!this.activeGames.has(roomId)) {
            let initialPlayer = 'X';
            if (gameType === 'connectfour') {
                initialPlayer = 'R';
            } else if (gameType === 'battleship' || gameType === 'tankbattle') {
                initialPlayer = 'P1';
            }

            this.activeGames.set(roomId, {
                gameType,
                players: [],
                gameState: this.initializeGameState(gameType),
                currentPlayer: initialPlayer
            });
        }

        const game = this.activeGames.get(roomId);

        if (game.players.length < 2) {
            game.players.push(socketId);

            let playerSymbol;
            if (game.gameType === 'tictactoe') {
                playerSymbol = game.players.length === 1 ? 'X' : 'O';
            } else if (game.gameType === 'connectfour') {
                playerSymbol = game.players.length === 1 ? 'R' : 'Y';
            } else if (game.gameType === 'battleship' || game.gameType === 'tankbattle') {
                playerSymbol = game.players.length === 1 ? 'P1' : 'P2';
            }

            return {
                success: true,
                playerSymbol,
                playerCount: game.players.length,
                currentPlayer: game.currentPlayer
            };
        } else {
            return { success: false };
        }
    }

    makeMove(roomId, position, player) {
        const game = this.activeGames.get(roomId);
        if (!game || game.players.length !== 2) return { success: false };

        // Turn-based games
        if (player !== game.currentPlayer) return { success: false };
        if (!this.isValidMove(game.gameState, position, game.gameType, player)) return { success: false };

        // Update game state; may return an effect summary (e.g., for tankbattle)
        const effectSummary = this.updateGameState(game.gameState, position, player, game.gameType);

        // Check for game over / winner
        const gameResult = this.checkGameResult(game.gameState, game.gameType);

        // Switch current player if game not over
        if (!gameResult.gameOver) {
            if (game.gameType === 'tictactoe') {
                game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
            } else if (game.gameType === 'connectfour') {
                game.currentPlayer = game.currentPlayer === 'R' ? 'Y' : 'R';
            } else if (game.gameType === 'battleship') {
                game.currentPlayer = game.currentPlayer === 'P1' ? 'P2' : 'P1';
            } else if (game.gameType === 'tankbattle') {
                game.currentPlayer = game.currentPlayer === 'P1' ? 'P2' : 'P1';
            }
        }

        return {
            success: true,
            gameState: game.gameState,
            currentPlayer: game.currentPlayer,
            gameResult,
            effectSummary // optional; client may append to battle log
        };
    }

    handleDisconnect(socketId) {
        for (const [roomId, game] of this.activeGames.entries()) {
            const idx = game.players.indexOf(socketId);
            if (idx !== -1) {
                game.players.splice(idx, 1);
                if (game.players.length === 0) {
                    setTimeout(() => {
                        if (this.activeGames.get(roomId)?.players.length === 0) {
                            this.activeGames.delete(roomId);
                        }
                    }, 60000);
                }
            }
        }
    }

    cleanupRoom(roomId) {
        this.activeGames.delete(roomId);
    }

    // ---------- Game-specific ----------
    initializeGameState(gameType) {
        if (gameType === 'tictactoe') {
            return Array(9).fill(null);
        }
        if (gameType === 'connectfour') {
            return Array(6).fill(null).map(() => Array(7).fill(null));
        }
        if (gameType === 'battleship') {
            return {
                boards: {
                    P1: Array(10).fill(null).map(() => Array(10).fill(null)),
                    P2: Array(10).fill(null).map(() => Array(10).fill(null))
                },
                attacks: {
                    P1: Array(10).fill(null).map(() => Array(10).fill(false)),
                    P2: Array(10).fill(null).map(() => Array(10).fill(false))
                },
                ships: {
                    P1: this.placeShipsRandomly(),
                    P2: this.placeShipsRandomly()
                }
            };
        }
        if (gameType === 'tankbattle') {
            return {
                hp: { P1: 100, P2: 100 },
                shield: { P1: false, P2: false },     // true if DEFEND active and not yet consumed
                lastAction: { P1: null, P2: null }    // 'attack' | 'defend' | 'heal'
            };
        }
        return null;
    }

    isValidMove(gameState, position, gameType, player) {
        if (gameType === 'tictactoe') {
            return position >= 0 && position < 9 && gameState[position] === null;
        }
        if (gameType === 'connectfour') {
            const col = position;
            for (let row = 5; row >= 0; row--) {
                if (gameState[row][col] === null) return true;
            }
            return false;
        }
        if (gameType === 'battleship') {
            const [row, col] = position;
            const opponent = player === 'P1' ? 'P2' : 'P1';
            return !gameState.attacks[opponent][row][col];
        }
        if (gameType === 'tankbattle') {
            return position === 'attack' || position === 'defend' || position === 'heal';
        }
        return false;
    }

    updateGameState(gameState, position, player, gameType) {
        if (gameType === 'tictactoe') {
            gameState[position] = player;
            return;
        }

        if (gameType === 'connectfour') {
            const col = position;
            for (let row = 5; row >= 0; row--) {
                if (gameState[row][col] === null) {
                    gameState[row][col] = player;
                    break;
                }
            }
            return;
        }

        if (gameType === 'battleship') {
            const [row, col] = position;
            const opponent = player === 'P1' ? 'P2' : 'P1';
            gameState.attacks[opponent][row][col] = true;

            const shipHit = gameState.ships[opponent].some(ship =>
                ship.positions.some(pos => pos[0] === row && pos[1] === col)
            );

            gameState.boards[opponent][row][col] = shipHit ? 'hit' : 'miss';
            return;
        }

        if (gameType === 'tankbattle') {
            const me = player;
            const opp = player === 'P1' ? 'P2' : 'P1';
            let summary = '';

            if (position === 'attack') {
                // roll damage 10–20
                let dmg = 10 + Math.floor(Math.random() * 11); // 10..20 inclusive
                let mitigated = false;

                // if opponent has shield, halve damage and consume shield
                if (gameState.shield[opp]) {
                    dmg = Math.ceil(dmg / 2);
                    gameState.shield[opp] = false;
                    mitigated = true;
                }

                gameState.hp[opp] = Math.max(0, gameState.hp[opp] - dmg);
                gameState.lastAction[me] = 'attack';

                summary = `${me} attacked ${opp} for ${dmg} damage${mitigated ? ' (shielded)' : ''}.`;

            } else if (position === 'defend') {
                // sets shield to block next attack (halve once)
                gameState.shield[me] = true;
                gameState.lastAction[me] = 'defend';

                summary = `${me} is defending (next incoming attack halved).`;

            } else if (position === 'heal') {
                const before = gameState.hp[me];
                const after = Math.min(100, before + 10);
                const healed = after - before;

                gameState.hp[me] = after;
                gameState.lastAction[me] = 'heal';

                summary = `${me} healed ${healed} HP (now ${after}).`;
            }

            return summary; // effectSummary for client log
        }
    }

    checkGameResult(gameState, gameType) {
        if (gameType === 'tictactoe') {
            const wins = [
                [0, 1, 2], [3, 4, 5], [6, 7, 8],
                [0, 3, 6], [1, 4, 7], [2, 5, 8],
                [0, 4, 8], [2, 4, 6]
            ];
            for (const [a, b, c] of wins) {
                if (gameState[a] && gameState[a] === gameState[b] && gameState[a] === gameState[c])
                    return { gameOver: true, winner: gameState[a], draw: false };
            }
            if (gameState.every(cell => cell !== null))
                return { gameOver: true, winner: null, draw: true };
            return { gameOver: false, winner: null, draw: false };
        }

        if (gameType === 'connectfour') {
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 7; c++) {
                    const v = gameState[r][c];
                    if (!v) continue;
                    if (c <= 3 && v === gameState[r][c + 1] && v === gameState[r][c + 2] && v === gameState[r][c + 3])
                        return { gameOver: true, winner: v, draw: false };
                    if (r <= 2 && v === gameState[r + 1][c] && v === gameState[r + 2][c] && v === gameState[r + 3][c])
                        return { gameOver: true, winner: v, draw: false };
                    if (r <= 2 && c <= 3 && v === gameState[r + 1][c + 1] && v === gameState[r + 2][c + 2] && v === gameState[r + 3][c + 3])
                        return { gameOver: true, winner: v, draw: false };
                    if (r >= 3 && c <= 3 && v === gameState[r - 1][c + 1] && v === gameState[r - 2][c + 2] && v === gameState[r - 3][c + 3])
                        return { gameOver: true, winner: v, draw: false };
                }
            }
            if (gameState[0].every(cell => cell !== null))
                return { gameOver: true, winner: null, draw: true };
            return { gameOver: false, winner: null, draw: false };
        }

        if (gameType === 'battleship') {
            const p1Sunk = this.areAllShipsSunk(gameState.ships.P1, gameState.attacks.P1);
            const p2Sunk = this.areAllShipsSunk(gameState.ships.P2, gameState.attacks.P2);
            if (p1Sunk) return { gameOver: true, winner: 'P2', draw: false };
            if (p2Sunk) return { gameOver: true, winner: 'P1', draw: false };
            return { gameOver: false, winner: null, draw: false };
        }

        if (gameType === 'tankbattle') {
            const p1Dead = gameState.hp.P1 <= 0;
            const p2Dead = gameState.hp.P2 <= 0;
            if (p1Dead && !p2Dead) return { gameOver: true, winner: 'P2', draw: false };
            if (p2Dead && !p1Dead) return { gameOver: true, winner: 'P1', draw: false };
            if (p1Dead && p2Dead)   return { gameOver: true, winner: null, draw: true };
            return { gameOver: false, winner: null, draw: false };
        }

        return { gameOver: false, winner: null, draw: false };
    }

    // ---------- Battleship helpers ----------
    placeShipsRandomly() {
        const ships = [
            { name: 'carrier', size: 5, positions: [] },
            { name: 'battleship', size: 4, positions: [] },
            { name: 'cruiser', size: 3, positions: [] },
            { name: 'submarine', size: 3, positions: [] },
            { name: 'destroyer', size: 2, positions: [] }
        ];
        const board = Array(10).fill(null).map(() => Array(10).fill(false));

        ships.forEach(ship => {
            let placed = false;
            while (!placed) {
                const horiz = Math.random() > 0.5;
                const row = Math.floor(Math.random() * 10);
                const col = Math.floor(Math.random() * 10);
                if (this.canPlaceShip(board, row, col, ship.size, horiz)) {
                    this.placeShip(board, ship, row, col, horiz);
                    placed = true;
                }
            }
        });
        return ships;
    }

    canPlaceShip(board, row, col, size, horiz) {
        if (horiz) {
            if (col + size > 10) return false;
            for (let i = 0; i < size; i++) if (board[row][col + i]) return false;
        } else {
            if (row + size > 10) return false;
            for (let i = 0; i < size; i++) if (board[row + i][col]) return false;
        }
        return true;
    }

    placeShip(board, ship, row, col, horiz) {
        ship.positions = [];
        if (horiz) {
            for (let i = 0; i < ship.size; i++) {
                board[row][col + i] = true;
                ship.positions.push([row, col + i]);
            }
        } else {
            for (let i = 0; i < ship.size; i++) {
                board[row + i][col] = true;
                ship.positions.push([row + i, col]);
            }
        }
    }

    areAllShipsSunk(ships, attacks) {
        return ships.every(ship =>
            ship.positions.every(pos => attacks[pos[0]][pos[1]])
        );
    }
}

module.exports = GameHandler;
