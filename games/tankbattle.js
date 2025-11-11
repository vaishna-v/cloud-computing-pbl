// games/tankbattle.js

// ---------- utils ----------
function getRoomId() {
  const url = new URL(window.location.href);
  let roomId = url.searchParams.get('room');
  if (!roomId) {
    roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url.toString());
  }
  return roomId;
}

const $ = (id) => document.getElementById(id);

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function pct(n, max) {
  return clamp(Math.round((n / max) * 100), 0, 100) + '%';
}

// ---------- main ----------
document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const roomId = getRoomId();
  $('roomId').textContent = roomId;

  // DOM refs
  const elStatus = $('gameStatus');
  const elWinner = $('winnerMessage');

  const elYourName = $('yourName');
  const elOppName = $('opponentName');

  const elYourTurn = $('yourTurnBadge');
  const elOppTurn = $('opponentTurnBadge');

  const elPlayerHP = $('playerHP');
  const elPlayerHPBar = $('playerHPBar');
  const elOppHP = $('opponentHP');
  const elOppHPBar = $('opponentHPBar');

  const elPlayerLast = $('playerLastAction');
  const elOppLast = $('opponentLastAction');

  const btnAttack = $('attackBtn');
  const btnDefend = $('defendBtn');
  const btnHeal = $('healBtn');

  const elLog = $('battleLog');

  // local state
  let playerSymbol = null;            // 'P1' | 'P2'
  let currentPlayer = 'P1';           // from server
  let gameActive = false;
  let gameOver = false;

  // expected server gameState shape (example):
  // {
  //   hp: { P1: 100, P2: 100 },
  //   shield: { P1: false, P2: false },
  //   lastAction: { P1: null, P2: null }
  // }
  let gameState = {
    hp: { P1: 100, P2: 100 },
    shield: { P1: false, P2: false },
    lastAction: { P1: null, P2: null }
  };

  // ---------- socket wiring ----------
  socket.emit('join-room', roomId, 'tankbattle');

  socket.on('player-assigned', (symbol) => {
    playerSymbol = symbol; // 'P1' or 'P2'
    setNames();
    updateStatus();
    updateUI();
  });

  socket.on('player-joined', (data = {}) => {
    gameActive = (data.playerCount === 2);
    if (typeof data.currentPlayer === 'string') currentPlayer = data.currentPlayer;
    updateStatus();
    updateUI();
  });

  socket.on('move-made', (data = {}) => {
    // server should send back: { position, player, gameState, currentPlayer, gameResult? }
    if (data.gameState) gameState = normalizeGameState(data.gameState);
    if (data.currentPlayer) currentPlayer = data.currentPlayer;

    // Log this move if provided
    if (data.player && data.position) {
      const actor = youIf(data.player);
      logAdd(`${actor} used ${fmtAction(data.position)}.`);
    }

    // When server computes damage/heal, it can also send an optional summary for the log
    if (data.effectSummary) {
      logAdd(data.effectSummary);
    }

    updateUI();
    updateStatus();

    // Check game over
    const result = data.gameResult || {};
    if (result.gameOver) {
      gameOver = true;
      const who = result.winner ? youIf(result.winner) : 'No one';
      elWinner.textContent = (result.winner && result.winner === playerSymbol)
        ? '🏆 You win!'
        : (result.winner ? '💥 You lost!' : 'Draw!');
      logAdd(`🏁 ${who} wins the battle!`);
      disableActions(true);
    }
  });

  socket.on('player-left', () => {
    gameActive = false;
    setStatus('Opponent left the game.');
    disableActions(true);
  });

  socket.on('room-full', () => {
    gameActive = false;
    setStatus('Room is full. Please create a new game.');
    disableActions(true);
  });

  // ---------- UI actions ----------
  btnAttack.addEventListener('click', () => sendAction('attack'));
  btnDefend.addEventListener('click', () => sendAction('defend'));
  btnHeal.addEventListener('click', () => sendAction('heal'));

  function sendAction(action) {
    if (!canAct()) return;
    // emit like the other games: position carries the move
    socket.emit('make-move', {
      roomId,
      position: action,
      player: playerSymbol
    });
    // Optimistic local UI: show we did something in "last action" until server updates
    setLastActionLocal(playerSymbol, action);
    // Disable until server turn switches
    disableActions(true);
    setStatus('Waiting for opponent...');
  }

  // ---------- helpers ----------
  function normalizeGameState(state) {
    // Ensure all expected sub-objects exist
    return {
      hp: { P1: val(state?.hp?.P1, 100), P2: val(state?.hp?.P2, 100) },
      shield: { P1: !!state?.shield?.P1, P2: !!state?.shield?.P2 },
      lastAction: { P1: state?.lastAction?.P1 ?? null, P2: state?.lastAction?.P2 ?? null }
    };
  }

  function val(v, d) {
    return typeof v === 'number' ? v : d;
  }

  function youIf(p) {
    if (p === playerSymbol) return 'You';
    return 'Opponent';
  }

  function fmtAction(a) {
    if (!a) return '—';
    const map = { attack: 'Attack', defend: 'Defend', heal: 'Heal' };
    return map[a] || String(a).toUpperCase();
  }

  function canAct() {
    return gameActive && !gameOver && playerSymbol && currentPlayer === playerSymbol;
  }

  function setNames() {
    elYourName.textContent = `You (${playerSymbol})`;
    elOppName.textContent = `Opponent (${playerSymbol === 'P1' ? 'P2' : 'P1'})`;
  }

  function setStatus(msg) {
    elStatus.textContent = msg;
  }

  function updateStatus() {
    if (gameOver) {
      setStatus('Game over.');
      return;
    }
    if (!playerSymbol) {
      setStatus('Connecting to game...');
      return;
    }
    if (!gameActive) {
      setStatus('Waiting for opponent to join...');
      return;
    }
    if (currentPlayer === playerSymbol) {
      setStatus('Your turn — choose an action.');
    } else {
      setStatus('Opponent’s turn...');
    }
  }

  function updateUI() {
    // Turn badges
    elYourTurn.style.display = currentPlayer === playerSymbol ? 'inline-block' : 'none';
    elOppTurn.style.display = currentPlayer !== playerSymbol ? 'inline-block' : 'none';

    // HP values + bars (assume max 100)
    const myHP = gameState.hp[playerSymbol] ?? 100;
    const oppKey = playerSymbol === 'P1' ? 'P2' : 'P1';
    const oppHP = gameState.hp[oppKey] ?? 100;

    elPlayerHP.textContent = `${clamp(myHP, 0, 100)} HP`;
    elOppHP.textContent = `${clamp(oppHP, 0, 100)} HP`;
    elPlayerHPBar.style.width = pct(myHP, 100);
    elOppHPBar.style.width = pct(oppHP, 100);

    // Last actions
    elPlayerLast.textContent = fmtAction(gameState.lastAction[playerSymbol]);
    elOppLast.textContent = fmtAction(gameState.lastAction[oppKey]);

    // Buttons enabled only on your turn and if active
    disableActions(!canAct());
  }

  function setLastActionLocal(symbol, action) {
    if (symbol === playerSymbol) {
      elPlayerLast.textContent = fmtAction(action);
    }
  }

  function disableActions(disabled) {
    [btnAttack, btnDefend, btnHeal].forEach(b => b.disabled = !!disabled);
  }

  function logAdd(text) {
    if (!text) return;
    const li = document.createElement('li');
    li.className = 'log-item';
    li.textContent = text;
    elLog.appendChild(li);
    // auto-scroll
    elLog.scrollTop = elLog.scrollHeight;
  }

  // initial paint
  updateStatus();
  updateUI();
});
