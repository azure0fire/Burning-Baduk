// gameLogic.js
// 19x19 바둑 규칙 엔진: 착수, 따내기(사석), 자충수 금지, 패(ko) 금지, 자동 집계산

const SIZE = 19;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const KOMI = 6.5; // 백 덤

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

function inBounds(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function neighbors(x, y) {
  return [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ].filter(([nx, ny]) => inBounds(nx, ny));
}

// 좌표 (x,y)가 속한 돌 그룹과 그 그룹의 활로(liberty)를 찾는다
function getGroup(board, x, y) {
  const color = board[y][x];
  const stones = new Set();
  const liberties = new Set();
  if (color === EMPTY) return { stones, liberties };

  const stack = [[x, y]];
  const visited = new Set([`${x},${y}`]);

  while (stack.length) {
    const [cx, cy] = stack.pop();
    stones.add(`${cx},${cy}`);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const key = `${nx},${ny}`;
      const nColor = board[ny][nx];
      if (nColor === EMPTY) {
        liberties.add(key);
      } else if (nColor === color && !visited.has(key)) {
        visited.add(key);
        stack.push([nx, ny]);
      }
    }
  }
  return { stones, liberties };
}

function boardKey(board) {
  return board.map((row) => row.join('')).join('/');
}

function cloneBoard(board) {
  return board.map((row) => row.slice());
}

/**
 * 돌을 놓는다.
 * @returns {ok: boolean, reason?: string, board?, captured?: number}
 */
function applyMove(board, x, y, color, positionHistory) {
  if (!inBounds(x, y)) return { ok: false, reason: 'out_of_bounds' };
  if (board[y][x] !== EMPTY) return { ok: false, reason: 'occupied' };

  const opponent = color === BLACK ? WHITE : BLACK;
  const newBoard = cloneBoard(board);
  newBoard[y][x] = color;

  // 1) 상대 그룹 중 활로가 0이 된 그룹을 따낸다
  let capturedCount = 0;
  const checked = new Set();
  for (const [nx, ny] of neighbors(x, y)) {
    if (newBoard[ny][nx] === opponent) {
      const key = `${nx},${ny}`;
      if (checked.has(key)) continue;
      const { stones, liberties } = getGroup(newBoard, nx, ny);
      stones.forEach((s) => checked.add(s));
      if (liberties.size === 0) {
        stones.forEach((s) => {
          const [sx, sy] = s.split(',').map(Number);
          newBoard[sy][sx] = EMPTY;
        });
        capturedCount += stones.size;
      }
    }
  }

  // 2) 자충수(자살수) 금지 - 방금 놓은 돌의 그룹이 활로 0이면 불법
  const myGroup = getGroup(newBoard, x, y);
  if (myGroup.liberties.size === 0) {
    return { ok: false, reason: 'suicide' };
  }

  // 3) 패(ko) / 동형반복 금지 - 이전에 나온 적 있는 판 모양이면 불법
  const key = boardKey(newBoard);
  if (positionHistory && positionHistory.has(key)) {
    return { ok: false, reason: 'ko' };
  }

  return { ok: true, board: newBoard, captured: capturedCount, positionKey: key };
}

/**
 * 종국 시 집 계산 (중국식 area scoring: 돌 + 집)
 */
function calculateScore(board) {
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  let blackStones = 0;
  let whiteStones = 0;
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let neutral = 0;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = board[y][x];
      if (c === BLACK) blackStones++;
      else if (c === WHITE) whiteStones++;
    }
  }

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (board[y][x] !== EMPTY || visited[y][x]) continue;

      // 빈 영역 flood fill
      const region = [];
      const borderColors = new Set();
      const stack = [[x, y]];
      visited[y][x] = true;

      while (stack.length) {
        const [cx, cy] = stack.pop();
        region.push([cx, cy]);
        for (const [nx, ny] of neighbors(cx, cy)) {
          const c = board[ny][nx];
          if (c === EMPTY) {
            if (!visited[ny][nx]) {
              visited[ny][nx] = true;
              stack.push([nx, ny]);
            }
          } else {
            borderColors.add(c);
          }
        }
      }

      if (borderColors.size === 1) {
        const owner = [...borderColors][0];
        if (owner === BLACK) blackTerritory += region.length;
        else whiteTerritory += region.length;
      } else {
        neutral += region.length;
      }
    }
  }

  const blackScore = blackStones + blackTerritory;
  const whiteScore = whiteStones + whiteTerritory + KOMI;

  return {
    blackStones,
    whiteStones,
    blackTerritory,
    whiteTerritory,
    neutral,
    blackScore,
    whiteScore,
    winner: blackScore > whiteScore ? 'black' : 'white',
    diff: Math.abs(blackScore - whiteScore),
  };
}

module.exports = {
  SIZE,
  EMPTY,
  BLACK,
  WHITE,
  KOMI,
  createEmptyBoard,
  applyMove,
  calculateScore,
  boardKey,
};
