const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const {
  createEmptyBoard,
  applyMove,
  calculateScore,
  BLACK,
  WHITE,
} = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// rooms: { [code]: RoomState }
const rooms = new Map();

function generateRoomCode() {
  let code;
  do {
    code = String(Math.floor(1000000 + Math.random() * 9000000)); // 7자리 숫자
  } while (rooms.has(code));
  return code;
}

function createRoom(hostName, hostSocketId) {
  const code = generateRoomCode();
  const room = {
    code,
    board: createEmptyBoard(),
    positionHistory: new Set(),
    turn: BLACK, // 방 만든 사람이 흑으로 시작
    passCount: 0,
    gameOver: false,
    result: null,
    players: {
      [hostSocketId]: { name: hostName, color: BLACK },
    },
    order: [hostSocketId],
  };
  rooms.set(code, room);
  return room;
}

function roomPublicState(room) {
  return {
    code: room.code,
    board: room.board,
    turn: room.turn,
    passCount: room.passCount,
    gameOver: room.gameOver,
    result: room.result,
    players: Object.values(room.players),
  };
}

function otherColor(color) {
  return color === BLACK ? WHITE : BLACK;
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name }) => {
    const playerName = (name || '').trim().slice(0, 20) || '익명';
    const room = createRoom(playerName, socket.id);
    socket.join(room.code);
    socket.emit('room_created', { code: room.code, color: BLACK, state: roomPublicState(room) });
  });

  socket.on('join_room', ({ name, code }) => {
    const room = rooms.get(code);
    if (!room) {
      socket.emit('join_error', { message: '존재하지 않는 방 코드입니다.' });
      return;
    }
    if (room.order.length >= 2) {
      socket.emit('join_error', { message: '이미 인원이 가득 찬 방입니다.' });
      return;
    }
    const playerName = (name || '').trim().slice(0, 20) || '익명';
    room.players[socket.id] = { name: playerName, color: WHITE };
    room.order.push(socket.id);
    socket.join(code);

    socket.emit('room_joined', { code, color: WHITE, state: roomPublicState(room) });
    io.to(code).emit('opponent_joined', { state: roomPublicState(room) });
  });

  socket.on('place_stone', ({ code, x, y }) => {
    const room = rooms.get(code);
    if (!room || room.gameOver) return;
    const player = room.players[socket.id];
    if (!player || player.color !== room.turn) return;

    const result = applyMove(room.board, x, y, room.turn, room.positionHistory);
    if (!result.ok) {
      socket.emit('illegal_move', { reason: result.reason });
      return;
    }

    room.board = result.board;
    room.positionHistory.add(result.positionKey);
    room.passCount = 0;
    room.turn = otherColor(room.turn);

    io.to(code).emit('update', { state: roomPublicState(room), lastMove: { x, y }, captured: result.captured });
  });

  socket.on('pass_turn', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.gameOver) return;
    const player = room.players[socket.id];
    if (!player || player.color !== room.turn) return;

    room.passCount += 1;
    room.turn = otherColor(room.turn);

    if (room.passCount >= 2) {
      room.gameOver = true;
      room.result = { type: 'score', ...calculateScore(room.board) };
    }
    io.to(code).emit('update', { state: roomPublicState(room), passed: true });
  });

  socket.on('resign', ({ code }) => {
    const room = rooms.get(code);
    if (!room || room.gameOver) return;
    const player = room.players[socket.id];
    if (!player) return;

    room.gameOver = true;
    room.result = { type: 'resign', winner: player.color === BLACK ? 'white' : 'black' };
    io.to(code).emit('update', { state: roomPublicState(room) });
  });

  socket.on('disconnect', () => {
    for (const [code, room] of rooms.entries()) {
      if (room.players[socket.id]) {
        io.to(code).emit('opponent_left');
        // 방 정리 (약간의 유예 없이 즉시 제거 - 단순화)
        rooms.delete(code);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Baduk Fire server running on port ${PORT}`);
});
