const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;


// Store all active game rooms
const rooms = {};

// Generate random 5x5 bingo board with numbers 1-25
function generateBoard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  // Shuffle array
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// Generate 4-character room code
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

// Count completed lines (rows, columns, diagonals)
function countLines(selected) {
  let lines = 0;
  
  // Check rows
  for (let row = 0; row < 5; row++) {
    let complete = true;
    for (let col = 0; col < 5; col++) {
      if (!selected[row * 5 + col]) {
        complete = false;
        break;
      }
    }
    if (complete) lines++;
  }
  
  // Check columns
  for (let col = 0; col < 5; col++) {
    let complete = true;
    for (let row = 0; row < 5; row++) {
      if (!selected[row * 5 + col]) {
        complete = false;
        break;
      }
    }
    if (complete) lines++;
  }
  
  // Check diagonal (top-left to bottom-right)
  let diag1Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!selected[i * 5 + i]) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) lines++;
  
  // Check diagonal (top-right to bottom-left)
  let diag2Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!selected[i * 5 + (4 - i)]) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) lines++;
  
  return lines;
}

// AI makes a move - picks random unselected number
function makeAIMove(room, aiPlayerId) {
  const board = room.boards[aiPlayerId];
  const selected = room.selected[aiPlayerId];
  
  // Find all unselected indices
  const unselectedIndices = [];
  for (let i = 0; i < selected.length; i++) {
    if (!selected[i]) {
      unselectedIndices.push(i);
    }
  }
  
  if (unselectedIndices.length === 0) return null;
  
  // Pick random unselected index
  const randomIndex = unselectedIndices[Math.floor(Math.random() * unselectedIndices.length)];
  return board[randomIndex];
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a new room (vs Computer or vs Player)
  socket.on('createRoom', ({ vsComputer }) => {
    const roomCode = generateRoomCode();
    const board1 = generateBoard();
    const board2 = generateBoard();
    
    const aiPlayerId = vsComputer ? 'AI' : null;
    
    rooms[roomCode] = {
      players: vsComputer ? [socket.id, aiPlayerId] : [socket.id],
      boards: {
        [socket.id]: board1,
        ...(vsComputer ? { [aiPlayerId]: board2 } : {})
      },
      selected: {
        [socket.id]: Array(25).fill(false),
        ...(vsComputer ? { [aiPlayerId]: Array(25).fill(false) } : {})
      },
      globalSelected: [], // Track all selected numbers globally
      currentTurn: socket.id,
      lines: {
        [socket.id]: 0,
        ...(vsComputer ? { [aiPlayerId]: 0 } : {})
      },
      gameStarted: vsComputer ? true : false,
      vsComputer: vsComputer || false,
      aiPlayerId: aiPlayerId
    };
    
    socket.join(roomCode);
    socket.emit('roomCreated', {
      roomCode,
      board: board1,
      playerNumber: 1
    });
    
    // If vs computer, start game immediately
    if (vsComputer) {
      socket.emit('gameStart', {
        currentTurn: socket.id,
        players: [socket.id, aiPlayerId],
        vsComputer: true
      });
    }
    
    console.log(`Room ${roomCode} created by ${socket.id}${vsComputer ? ' (vs Computer)' : ''}`);
  });

  // Join an existing room
  socket.on('joinRoom', (roomCode) => {
    const room = rooms[roomCode];
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (room.vsComputer) {
      socket.emit('error', { message: 'Cannot join AI game' });
      return;
    }
    
    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }
    
    const board = generateBoard();
    room.players.push(socket.id);
    room.boards[socket.id] = board;
    room.selected[socket.id] = Array(25).fill(false);
    room.lines[socket.id] = 0;
    room.globalSelected = []; // Initialize global selected
    room.gameStarted = true;
    
    socket.join(roomCode);
    
    // Notify the player who joined
    socket.emit('roomJoined', {
      roomCode,
      board,
      playerNumber: 2
    });
    
    // Notify both players that game is starting
    io.to(roomCode).emit('gameStart', {
      currentTurn: room.currentTurn,
      players: room.players,
      vsComputer: false
    });
    
    console.log(`${socket.id} joined room ${roomCode}`);
  });

  // Handle number selection
  socket.on('selectNumber', ({ roomCode, number }) => {
    const room = rooms[roomCode];
    
    console.log(`selectNumber received: room=${roomCode}, number=${number}, player=${socket.id}`);
    
    if (!room) {
      console.log('Room not found');
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    if (!room.gameStarted) {
      console.log('Game not started');
      socket.emit('error', { message: 'Game not started yet' });
      return;
    }
    
    console.log(`Current turn: ${room.currentTurn}, Player: ${socket.id}`);
    
    // Check if it's this player's turn
    if (room.currentTurn !== socket.id) {
      console.log('Not player turn');
      socket.emit('error', { message: 'Not your turn' });
      return;
    }
    
    // Check if number already globally selected
    if (room.globalSelected.includes(number)) {
      console.log('Number already selected globally');
      socket.emit('error', { message: 'Number already selected' });
      return;
    }
    
    // Add to global selected numbers
    room.globalSelected.push(number);
    
    // Mark the number on ALL players' boards if they have it
    for (const playerId of room.players) {
      const board = room.boards[playerId];
      const index = board.indexOf(number);
      
      if (index !== -1) {
        room.selected[playerId][index] = true;
        // Recalculate lines for this player
        room.lines[playerId] = countLines(room.selected[playerId]);
        
        console.log(`Player ${playerId} now has ${room.lines[playerId]} lines`);
        
        // Check if this player won (5 lines)
        if (room.lines[playerId] >= 5) {
          io.to(roomCode).emit('gameOver', {
            winner: playerId,
            players: room.players
          });
          console.log(`${playerId} won in room ${roomCode}`);
          return;
        }
      }
    }
    
    // Switch turn to other player
    const otherPlayer = room.players.find(p => p !== socket.id);
    room.currentTurn = otherPlayer;
    
    console.log(`Turn switched to ${otherPlayer}`);
    
    // Broadcast game update to all players
    io.to(roomCode).emit('gameUpdate', {
      selectedNumber: number,
      playerId: socket.id,
      currentTurn: room.currentTurn,
      lines: room.lines
    });
    
    // If vs Computer and it's AI's turn, make AI move after delay
    if (room.vsComputer && room.currentTurn === room.aiPlayerId) {
      console.log('AI turn starting...');
      setTimeout(() => {
        const aiNumber = makeAIMove(room, room.aiPlayerId);
        
        if (aiNumber && !room.globalSelected.includes(aiNumber)) {
          // Add to global selected
          room.globalSelected.push(aiNumber);
          
          // Mark on all players' boards
          for (const playerId of room.players) {
            const board = room.boards[playerId];
            const index = board.indexOf(aiNumber);
            
            if (index !== -1) {
              room.selected[playerId][index] = true;
              room.lines[playerId] = countLines(room.selected[playerId]);
              
              console.log(`AI move: Player ${playerId} now has ${room.lines[playerId]} lines`);
              
              // Check if won
              if (room.lines[playerId] >= 5) {
                io.to(roomCode).emit('gameOver', {
                  winner: playerId,
                  players: room.players
                });
                console.log(`${playerId} won in room ${roomCode}`);
                return;
              }
            }
          }
          
          // Switch turn back to human player
          room.currentTurn = socket.id;
          
          console.log(`Turn switched back to player ${socket.id}`);
          
          io.to(roomCode).emit('gameUpdate', {
            selectedNumber: aiNumber,
            playerId: room.aiPlayerId,
            currentTurn: room.currentTurn,
            lines: room.lines
          });
        }
      }, 1000); // AI thinks for 1 second
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up rooms when players disconnect
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (room.players.includes(socket.id)) {
        // Don't notify AI games
        if (!room.vsComputer) {
          io.to(roomCode).emit('playerDisconnected');
        }
        delete rooms[roomCode];
        console.log(`Room ${roomCode} deleted`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});