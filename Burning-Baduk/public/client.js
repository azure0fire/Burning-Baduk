// ===================== 공통 유틸: 화면 전환 =====================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
document.querySelectorAll('.back-btn').forEach((btn) => {
  btn.addEventListener('click', () => showScreen(btn.dataset.target));
});

// ===================== 오프라인용 바둑 규칙 엔진 (서버와 동일 로직 클라이언트 복제) =====================
const SIZE = 19;
const EMPTY = 0, BLACK = 1, WHITE = 2;
const KOMI = 6.5;

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}
function inBounds(x, y) { return x >= 0 && x < SIZE && y >= 0 && y < SIZE; }
function neighborsOf(x, y) {
  return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([nx,ny]) => inBounds(nx,ny));
}
function getGroup(board, x, y) {
  const color = board[y][x];
  const stones = new Set(), liberties = new Set();
  if (color === EMPTY) return { stones, liberties };
  const stack = [[x,y]], visited = new Set([`${x},${y}`]);
  while (stack.length) {
    const [cx,cy] = stack.pop();
    stones.add(`${cx},${cy}`);
    for (const [nx,ny] of neighborsOf(cx,cy)) {
      const key = `${nx},${ny}`;
      const nColor = board[ny][nx];
      if (nColor === EMPTY) liberties.add(key);
      else if (nColor === color && !visited.has(key)) { visited.add(key); stack.push([nx,ny]); }
    }
  }
  return { stones, liberties };
}
function boardKey(board) { return board.map(r => r.join('')).join('/'); }
function cloneBoard(board) { return board.map(r => r.slice()); }

function applyMoveLocal(board, x, y, color, positionHistory) {
  if (!inBounds(x,y)) return { ok:false, reason:'out_of_bounds' };
  if (board[y][x] !== EMPTY) return { ok:false, reason:'occupied' };
  const opponent = color === BLACK ? WHITE : BLACK;
  const newBoard = cloneBoard(board);
  newBoard[y][x] = color;

  let capturedCount = 0;
  const checked = new Set();
  for (const [nx,ny] of neighborsOf(x,y)) {
    if (newBoard[ny][nx] === opponent) {
      const key = `${nx},${ny}`;
      if (checked.has(key)) continue;
      const { stones, liberties } = getGroup(newBoard, nx, ny);
      stones.forEach(s => checked.add(s));
      if (liberties.size === 0) {
        stones.forEach(s => { const [sx,sy] = s.split(',').map(Number); newBoard[sy][sx] = EMPTY; });
        capturedCount += stones.size;
      }
    }
  }
  const myGroup = getGroup(newBoard, x, y);
  if (myGroup.liberties.size === 0) return { ok:false, reason:'suicide' };

  const key = boardKey(newBoard);
  if (positionHistory && positionHistory.has(key)) return { ok:false, reason:'ko' };

  return { ok:true, board:newBoard, captured:capturedCount, positionKey:key };
}

function calculateScoreLocal(board) {
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let blackStones=0, whiteStones=0, blackTerritory=0, whiteTerritory=0, neutral=0;
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
    const c = board[y][x];
    if (c===BLACK) blackStones++; else if (c===WHITE) whiteStones++;
  }
  for (let y=0;y<SIZE;y++) for (let x=0;x<SIZE;x++) {
    if (board[y][x] !== EMPTY || visited[y][x]) continue;
    const region = []; const borderColors = new Set();
    const stack=[[x,y]]; visited[y][x]=true;
    while (stack.length) {
      const [cx,cy]=stack.pop(); region.push([cx,cy]);
      for (const [nx,ny] of neighborsOf(cx,cy)) {
        const c = board[ny][nx];
        if (c===EMPTY) { if(!visited[ny][nx]) { visited[ny][nx]=true; stack.push([nx,ny]); } }
        else borderColors.add(c);
      }
    }
    if (borderColors.size===1) {
      const owner=[...borderColors][0];
      if (owner===BLACK) blackTerritory+=region.length; else whiteTerritory+=region.length;
    } else neutral+=region.length;
  }
  const blackScore = blackStones+blackTerritory;
  const whiteScore = whiteStones+whiteTerritory+KOMI;
  return { blackStones, whiteStones, blackTerritory, whiteTerritory, neutral, blackScore, whiteScore,
    winner: blackScore>whiteScore ? 'black':'white', diff: Math.abs(blackScore-whiteScore) };
}

// ===================== 바둑판 렌더링 =====================
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const MARGIN = 34;
const CELL = (canvas.width - MARGIN * 2) / (SIZE - 1);

const stoneImages = { loaded: false, black: null, white: null };
(function preloadStoneImages() {
  let toLoad = 2;
  const done = () => { toLoad--; if (toLoad <= 0) stoneImages.loaded = true; renderBoard(); };
  const blackImg = new Image();
  blackImg.onload = () => { stoneImages.black = blackImg; done(); };
  blackImg.onerror = done;
  blackImg.src = '/images/black.png';

  const whiteImg = new Image();
  whiteImg.onload = () => { stoneImages.white = whiteImg; done(); };
  whiteImg.onerror = done;
  whiteImg.src = '/images/white.png';
})();

function gridToPx(i) { return MARGIN + i * CELL; }
function pxToGrid(px) { return Math.round((px - MARGIN) / CELL); }

const HOSHI = [3,9,15];

function drawStone(x, y, color) {
  const px = gridToPx(x), py = gridToPx(y);
  const r = CELL * 0.46;
  const img = color === BLACK ? stoneImages.black : stoneImages.white;
  if (img) {
    ctx.drawImage(img, px - r, py - r, r * 2, r * 2);
  } else {
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(px - r*0.3, py - r*0.3, r*0.1, px, py, r);
    if (color === BLACK) { grad.addColorStop(0, '#555'); grad.addColorStop(1, '#000'); }
    else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#c9c9c9'); }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

let currentBoard = createEmptyBoard();
let lastMove = null;

function renderBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 나무 바둑판 배경
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, '#e3bd6e');
  bg.addColorStop(1, '#c8993f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(60,38,10,0.75)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < SIZE; i++) {
    const p = gridToPx(i);
    ctx.beginPath(); ctx.moveTo(gridToPx(0), p); ctx.lineTo(gridToPx(SIZE-1), p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, gridToPx(0)); ctx.lineTo(p, gridToPx(SIZE-1)); ctx.stroke();
  }
  // 화점
  ctx.fillStyle = 'rgba(60,38,10,0.85)';
  for (const hx of HOSHI) for (const hy of HOSHI) {
    ctx.beginPath();
    ctx.arc(gridToPx(hx), gridToPx(hy), 3.2, 0, Math.PI*2);
    ctx.fill();
  }
  // 돌
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (currentBoard[y][x] !== EMPTY) drawStone(x, y, currentBoard[y][x]);
  }
  // 마지막 수 표시
  if (lastMove) {
    const { x, y } = lastMove;
    ctx.beginPath();
    ctx.arc(gridToPx(x), gridToPx(y), CELL*0.14, 0, Math.PI*2);
    ctx.fillStyle = currentBoard[y][x] === BLACK ? '#ff6b35' : '#c1121f';
    ctx.fill();
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const x = pxToGrid(px), y = pxToGrid(py);
  if (!inBounds(x,y)) return;
  onBoardClick(x, y);
});

// ===================== 게임 상태 & 모드 분기 =====================
let mode = null; // 'online' | 'offline'
let socket = null;
let myColor = null;
let roomCode = null;
let playerNames = { black: '흑', white: '백' };

let offlineState = null; // { board, positionHistory, turn, passCount, gameOver }

const turnIndicator = document.getElementById('turn-indicator');
const tagBlack = document.getElementById('tag-black');
const tagWhite = document.getElementById('tag-white');
const gameMessage = document.getElementById('game-message');

function updateHeaderUI(turn, gameOver) {
  document.getElementById('name-black').textContent = playerNames.black;
  document.getElementById('name-white').textContent = playerNames.white;
  turnIndicator.textContent = gameOver ? '대국 종료' : (turn === BLACK ? '흑돌 차례' : '백돌 차례');
  tagBlack.classList.toggle('active-turn', !gameOver && turn === BLACK);
  tagWhite.classList.toggle('active-turn', !gameOver && turn === WHITE);
}

function showResultModal(result) {
  const modal = document.getElementById('result-modal');
  const title = document.getElementById('result-title');
  const body = document.getElementById('result-body');
  modal.classList.remove('hidden');
  if (result.type === 'resign') {
    title.textContent = '기권으로 종료';
    body.textContent = `${result.winner === 'black' ? playerNames.black + ' (흑)' : playerNames.white + ' (백)'} 승리!`;
  } else {
    title.textContent = '대국 종료 - 집계산 결과';
    body.textContent =
      `흑: 돌 ${result.blackStones} + 집 ${result.blackTerritory} = ${result.blackScore}\n` +
      `백: 돌 ${result.whiteStones} + 집 ${result.whiteTerritory} + 덤 ${KOMI} = ${result.whiteScore}\n\n` +
      `${result.winner === 'black' ? playerNames.black + ' (흑)' : playerNames.white + ' (백)'} 승리! (${result.diff.toFixed(1)}집 차)`;
  }
}
document.getElementById('btn-result-close').addEventListener('click', () => {
  document.getElementById('result-modal').classList.add('hidden');
});

// ---------- 화면1: 시작 ----------
document.getElementById('btn-mode-online').addEventListener('click', () => {
  const name = document.getElementById('input-name').value.trim();
  if (!name) { alert('이름을 입력해주세요.'); return; }
  playerNames.self = name;
  mode = 'online';
  ensureSocket();
  showScreen('screen-online-select');
});

document.getElementById('btn-mode-offline').addEventListener('click', () => {
  const name = document.getElementById('input-name').value.trim();
  document.getElementById('input-name-black').value = name || '';
  showScreen('screen-offline-setup');
});

// ---------- 화면2: 온라인 선택 ----------
document.getElementById('btn-create-room').addEventListener('click', () => {
  mode = 'online';
  socket.emit('create_room', { name: playerNames.self });
});
document.getElementById('btn-join-room-open').addEventListener('click', () => {
  showScreen('screen-join-code');
});
document.getElementById('btn-join-submit').addEventListener('click', () => {
  const code = document.getElementById('input-code').value.trim();
  if (!/^\d{7}$/.test(code)) {
    document.getElementById('join-error').textContent = '7자리 숫자를 입력해주세요.';
    return;
  }
  socket.emit('join_room', { name: playerNames.self, code });
});

// ---------- 화면3: 오프라인 설정 ----------
document.getElementById('btn-offline-start').addEventListener('click', () => {
  const bName = document.getElementById('input-name-black').value.trim() || '흑돌';
  const wName = document.getElementById('input-name-white').value.trim() || '백돌';
  playerNames.black = bName;
  playerNames.white = wName;
  mode = 'offline';
  offlineState = {
    board: createEmptyBoard(),
    positionHistory: new Set(),
    turn: BLACK,
    passCount: 0,
    gameOver: false,
  };
  currentBoard = offlineState.board;
  lastMove = null;
  renderBoard();
  updateHeaderUI(BLACK, false);
  gameMessage.textContent = '오프라인 대국: 같은 화면에서 번갈아 두세요.';
  showScreen('screen-game');
});

// ---------- 소켓 연결 (온라인 전용, 지연 초기화) ----------
function ensureSocket() {
  if (socket) return;
  socket = io();

  socket.on('room_created', ({ code, color, state }) => {
    roomCode = code;
    myColor = color;
    document.getElementById('room-code-display').textContent = code;
    showScreen('screen-waiting');
  });

  socket.on('join_error', ({ message }) => {
    document.getElementById('join-error').textContent = message;
  });

  socket.on('room_joined', ({ code, color, state }) => {
    roomCode = code;
    myColor = color;
    applyRemoteState(state);
  });

  socket.on('opponent_joined', ({ state }) => {
    applyRemoteState(state);
    showScreen('screen-game');
    gameMessage.textContent = '상대가 입장했습니다. 대국을 시작하세요!';
  });

  socket.on('update', ({ state, lastMove: lm }) => {
    applyRemoteState(state);
    if (lm) lastMove = lm;
    renderBoard();
  });

  socket.on('illegal_move', ({ reason }) => {
    const map = { occupied: '이미 돌이 놓여있습니다.', suicide: '자충수는 둘 수 없습니다.', ko: '패(동형반복) 규칙 위반입니다.', out_of_bounds: '판 밖입니다.' };
    gameMessage.textContent = map[reason] || '착수할 수 없습니다.';
  });

  socket.on('opponent_left', () => {
    gameMessage.textContent = '상대가 나갔습니다. 방이 종료되었습니다.';
  });
}

function applyRemoteState(state) {
  playerNames.black = (state.players.find(p => p.color === BLACK) || {}).name || '흑';
  playerNames.white = (state.players.find(p => p.color === WHITE) || {}).name || '백';
  currentBoard = state.board;
  updateHeaderUI(state.turn, state.gameOver);
  if (state.gameOver && state.result) {
    showResultModal(state.result);
  }
}

// ---------- 착수 클릭 처리 (온라인/오프라인 공용 분기) ----------
function onBoardClick(x, y) {
  if (mode === 'online') {
    if (!roomCode || myColor === null) return;
    socket.emit('place_stone', { code: roomCode, x, y });
  } else if (mode === 'offline') {
    if (offlineState.gameOver) return;
    const result = applyMoveLocal(offlineState.board, x, y, offlineState.turn, offlineState.positionHistory);
    if (!result.ok) {
      const map = { occupied: '이미 돌이 놓여있습니다.', suicide: '자충수는 둘 수 없습니다.', ko: '패(동형반복) 규칙 위반입니다.' };
      gameMessage.textContent = map[result.reason] || '착수할 수 없습니다.';
      return;
    }
    offlineState.board = result.board;
    offlineState.positionHistory.add(result.positionKey);
    offlineState.passCount = 0;
    offlineState.turn = offlineState.turn === BLACK ? WHITE : BLACK;
    currentBoard = offlineState.board;
    lastMove = { x, y };
    gameMessage.textContent = '';
    updateHeaderUI(offlineState.turn, false);
    renderBoard();
  }
}

// ---------- 패스 / 기권 / 나가기 ----------
document.getElementById('btn-pass').addEventListener('click', () => {
  if (mode === 'online') {
    socket.emit('pass_turn', { code: roomCode });
  } else if (mode === 'offline' && !offlineState.gameOver) {
    offlineState.passCount += 1;
    offlineState.turn = offlineState.turn === BLACK ? WHITE : BLACK;
    if (offlineState.passCount >= 2) {
      offlineState.gameOver = true;
      const result = calculateScoreLocal(offlineState.board);
      showResultModal({ type: 'score', ...result });
    }
    updateHeaderUI(offlineState.turn, offlineState.gameOver);
  }
});

document.getElementById('btn-resign').addEventListener('click', () => {
  if (!confirm('정말 기권하시겠습니까?')) return;
  if (mode === 'online') {
    socket.emit('resign', { code: roomCode });
  } else if (mode === 'offline' && !offlineState.gameOver) {
    offlineState.gameOver = true;
    const winner = offlineState.turn === BLACK ? 'white' : 'black';
    showResultModal({ type: 'resign', winner });
    updateHeaderUI(offlineState.turn, true);
  }
});

document.getElementById('btn-leave').addEventListener('click', () => {
  location.reload();
});
