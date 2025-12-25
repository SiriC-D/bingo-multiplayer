import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
  ScrollView,
  Animated,
  Dimensions
} from 'react-native';
import io from 'socket.io-client';

// IMPORTANT: Replace with your computer's local IP address
const SOCKET_URL =
  __DEV__
    ? 'http://10.62.135.57:3000'   // local testing
    : 'https://YOUR_RENDER_URL.onrender.com'; // production


const { width, height } = Dimensions.get('window');

// Confetti Component
const Confetti = ({ show }) => {
  const confettiPieces = useRef(
    Array.from({ length: 50 }, (_, i) => {
      const anim = new Animated.Value(-50);
      return {
        id: i,
        left: Math.random() * width,
        anim: anim,
        color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'][Math.floor(Math.random() * 5)]
      };
    })
  ).current;

  useEffect(() => {
    if (show) {
      confettiPieces.forEach((piece) => {
        Animated.timing(piece.anim, {
          toValue: height + 100,
          duration: 3000 + Math.random() * 2000,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [show]);

  if (!show) return null;

  return (
    <View style={styles.confettiContainer}>
      {confettiPieces.map((piece) => (
        <Animated.View
          key={piece.id}
          style={[
            styles.confettiPiece,
            {
              backgroundColor: piece.color,
              left: piece.left,
              transform: [{ translateY: piece.anim }]
            }
          ]}
        />
      ))}
    </View>
  );
};

export default function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState('menu');
  const [roomCode, setRoomCode] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [board, setBoard] = useState([]);
  const [selected, setSelected] = useState([]);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [lines, setLines] = useState({});
  const [winner, setWinner] = useState(null);
  const [vsComputer, setVsComputer] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [completedLines, setCompletedLines] = useState([]);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Check which lines are completed for current player
  const checkCompletedLines = (selectedArray) => {
    const completed = [];
    
    // Check rows
    for (let row = 0; row < 5; row++) {
      let complete = true;
      for (let col = 0; col < 5; col++) {
        if (!selectedArray[row * 5 + col]) {
          complete = false;
          break;
        }
      }
      if (complete) completed.push({ type: 'row', index: row });
    }
    
    // Check columns
    for (let col = 0; col < 5; col++) {
      let complete = true;
      for (let row = 0; row < 5; row++) {
        if (!selectedArray[row * 5 + col]) {
          complete = false;
          break;
        }
      }
      if (complete) completed.push({ type: 'col', index: col });
    }
    
    // Check diagonal (top-left to bottom-right)
    let diag1 = true;
    for (let i = 0; i < 5; i++) {
      if (!selectedArray[i * 5 + i]) {
        diag1 = false;
        break;
      }
    }
    if (diag1) completed.push({ type: 'diag1' });
    
    // Check diagonal (top-right to bottom-left)
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!selectedArray[i * 5 + (4 - i)]) {
        diag2 = false;
        break;
      }
    }
    if (diag2) completed.push({ type: 'diag2' });
    
    return completed;
  };

  // Check if a cell is part of a completed line
  const isCellInCompletedLine = (index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    
    for (const line of completedLines) {
      if (line.type === 'row' && line.index === row) return true;
      if (line.type === 'col' && line.index === col) return true;
      if (line.type === 'diag1' && row === col) return true;
      if (line.type === 'diag2' && row + col === 4) return true;
    }
    return false;
  };

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected:', newSocket.id);
      setMyPlayerId(newSocket.id);
    });

    newSocket.on('roomCreated', ({ roomCode, board, playerNumber }) => {
      setRoomCode(roomCode);
      setBoard(board);
      setSelected(Array(25).fill(false));
      setPlayerNumber(playerNumber);
      setMyPlayerId(newSocket.id);
    });

    newSocket.on('roomJoined', ({ roomCode, board, playerNumber }) => {
      setRoomCode(roomCode);
      setBoard(board);
      setSelected(Array(25).fill(false));
      setPlayerNumber(playerNumber);
      setMyPlayerId(newSocket.id);
      setGameState('waiting');
    });

    newSocket.on('gameStart', ({ currentTurn, players, vsComputer }) => {
      setMyPlayerId(newSocket.id);
      setCurrentTurn(currentTurn);
      setGameState('playing');
      setLines({});
      setCompletedLines([]);
      if (vsComputer !== undefined) {
        setVsComputer(vsComputer);
      }
    });

    newSocket.on('gameUpdate', ({ selectedNumber, playerId, currentTurn, lines }) => {
      setCurrentTurn(currentTurn);
      setLines(lines);
      
      setBoard(prevBoard => {
        const index = prevBoard.indexOf(selectedNumber);
        if (index !== -1) {
          setSelected(prev => {
            const newSelected = [...prev];
            newSelected[index] = true;
            
            // Check for completed lines and animate glow
            const completed = checkCompletedLines(newSelected);
            const prevLineCount = completedLines.length;
            setCompletedLines(completed);
            
            // If new line completed, trigger glow animation
            if (completed.length > prevLineCount) {
              Animated.sequence([
                Animated.timing(glowAnim, {
                  toValue: 1,
                  duration: 300,
                  useNativeDriver: false,
                }),
                Animated.timing(glowAnim, {
                  toValue: 0,
                  duration: 300,
                  useNativeDriver: false,
                })
              ]).start();
            }
            
            return newSelected;
          });
        }
        return prevBoard;
      });
    });

    newSocket.on('gameOver', ({ winner, players }) => {
      setWinner(winner);
      setGameState('gameOver');
      
      if (winner === newSocket.id) {
        setShowConfetti(true);
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.2,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
          })
        ]).start();
      }
    });

    newSocket.on('error', ({ message }) => {
      Alert.alert('Error', message);
    });

    newSocket.on('playerDisconnected', () => {
      Alert.alert('Game Ended', 'Other player disconnected');
      resetGame();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const createRoom = (vsAI = false) => {
    if (socket && socket.connected) {
      setVsComputer(vsAI);
      setMyPlayerId(socket.id);
      socket.emit('createRoom', { vsComputer: vsAI });
      if (!vsAI) {
        setGameState('waiting');
      }
    } else {
      Alert.alert('Connection Error', 'Connecting to server...');
      setTimeout(() => {
        if (socket && socket.connected) {
          createRoom(vsAI);
        }
      }, 500);
    }
  };

  const joinRoom = () => {
    if (socket && inputRoomCode.trim()) {
      socket.emit('joinRoom', inputRoomCode.toUpperCase());
    } else {
      Alert.alert('Error', 'Please enter a room code');
    }
  };

  const selectNumber = (number, index) => {
    if (currentTurn === myPlayerId && !selected[index]) {
      socket.emit('selectNumber', { roomCode, number });
    }
  };

  const resetGame = () => {
    setGameState('menu');
    setRoomCode('');
    setInputRoomCode('');
    setBoard([]);
    setSelected([]);
    setPlayerNumber(null);
    setCurrentTurn(null);
    setLines({});
    setWinner(null);
    setVsComputer(false);
    setShowConfetti(false);
    setCompletedLines([]);
    scaleAnim.setValue(1);
    glowAnim.setValue(0);
  };

  // MENU
  if (gameState === 'menu') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Bingo Game</Text>
          <Text style={styles.menuSubtitle}>Choose your game mode</Text>
          
          <TouchableOpacity 
            style={[styles.menuButton, styles.aiButton]} 
            onPress={() => createRoom(true)}
          >
            <Text style={styles.menuButtonText}>🤖 Play vs Computer</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.menuButton, styles.multiButton]} 
            onPress={() => createRoom(false)}
          >
            <Text style={styles.menuButtonText}>👥 Create Room</Text>
          </TouchableOpacity>
          
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>
          
          <TextInput
            style={styles.input}
            placeholder="Enter Room Code"
            placeholderTextColor="#999"
            value={inputRoomCode}
            onChangeText={setInputRoomCode}
            autoCapitalize="characters"
            maxLength={4}
          />
          <TouchableOpacity 
            style={[styles.menuButton, styles.joinButton]} 
            onPress={joinRoom}
          >
            <Text style={styles.menuButtonText}>Join Room</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // WAITING
  if (gameState === 'waiting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingEmoji}>⏳</Text>
          <Text style={styles.waitingTitle}>Room: {roomCode}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Player {playerNumber}</Text>
          </View>
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
          <TouchableOpacity style={styles.backBtn} onPress={resetGame}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // GAME OVER
  if (gameState === 'gameOver') {
    const isWinner = winner === myPlayerId;
    return (
      <SafeAreaView style={styles.container}>
        <Confetti show={showConfetti} />
        <Animated.View 
          style={[styles.gameOverContainer, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.gameOverEmoji}>{isWinner ? '🎉' : '😔'}</Text>
          <Text style={styles.gameOverTitle}>
            {isWinner ? 'You Won!' : vsComputer ? 'Computer Won!' : 'You Lost'}
          </Text>
          <Text style={styles.gameOverSub}>
            {isWinner ? 'Congratulations! 🏆' : 'Better luck next time!'}
          </Text>
          
          <View style={styles.finalScores}>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>You</Text>
              <Text style={styles.scoreValue}>{lines[myPlayerId] || 0}</Text>
            </View>
            <View style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>{vsComputer ? 'Computer' : 'Opponent'}</Text>
              <Text style={styles.scoreValue}>
                {vsComputer ? (lines['AI'] || 0) : (Object.keys(lines).find(id => id !== myPlayerId) ? lines[Object.keys(lines).find(id => id !== myPlayerId)] : 0)}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.playAgainBtn} onPress={resetGame}>
            <Text style={styles.menuButtonText}>🎮 Play Again</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // PLAYING
  const opponentLines = vsComputer 
    ? (lines['AI'] || 0) 
    : (Object.keys(lines).find(id => id !== myPlayerId) ? lines[Object.keys(lines).find(id => id !== myPlayerId)] : 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.gameHeader}>
          <View>
            <Text style={styles.headerLabel}>
              {vsComputer ? '🤖 AI Match' : '🎮 Room'}
            </Text>
            <Text style={styles.headerValue}>
              {vsComputer ? 'Computer' : roomCode}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>P{playerNumber}</Text>
          </View>
        </View>

        <View style={[
          styles.turnBox,
          currentTurn === myPlayerId ? styles.myTurnBox : styles.theirTurnBox
        ]}>
          <Text style={styles.turnText}>
            {currentTurn === myPlayerId ? "🎯 YOUR TURN" : vsComputer ? "🤖 COMPUTER'S TURN" : "⏳ OPPONENT'S TURN"}
          </Text>
        </View>

        <View style={styles.scoresBox}>
          <View style={styles.playerScore}>
            <Text style={styles.playerLabel}>You</Text>
            <View style={styles.dotsRow}>
              {[0,1,2,3,4].map((i) => (
                <View 
                  key={i} 
                  style={[styles.dot, i < (lines[myPlayerId] || 0) && styles.dotFilled]} 
                />
              ))}
            </View>
            <Text style={styles.playerValue}>{lines[myPlayerId] || 0} / 5</Text>
          </View>
          
          <Text style={styles.vsText}>VS</Text>
          
          <View style={styles.playerScore}>
            <Text style={styles.playerLabel}>{vsComputer ? '🤖' : 'Foe'}</Text>
            <View style={styles.dotsRow}>
              {[0,1,2,3,4].map((i) => (
                <View 
                  key={i} 
                  style={[styles.dot, i < opponentLines && styles.dotFilledOpp]} 
                />
              ))}
            </View>
            <Text style={styles.playerValue}>{opponentLines} / 5</Text>
          </View>
        </View>

        <View style={styles.boardBox}>
          {board.map((number, index) => {
            const isSelected = selected[index];
            const isMyTurn = currentTurn === myPlayerId;
            const inCompletedLine = isCellInCompletedLine(index);
            
            // Interpolate glow color
            const glowColor = glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['rgba(255, 107, 157, 0)', 'rgba(255, 215, 0, 0.8)']
            });
            
            return (
              <Animated.View
                key={index}
                style={[
                  styles.cellWrapper,
                  inCompletedLine && {
                    shadowColor: '#FFD700',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: glowAnim,
                    shadowRadius: 15,
                    elevation: 8,
                  }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.cell,
                    isSelected && styles.cellSelected,
                    !isMyTurn && styles.cellDisabled,
                    inCompletedLine && styles.cellGlow
                  ]}
                  onPress={() => selectNumber(number, index)}
                  disabled={!isMyTurn || isSelected}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cellNum, isSelected && styles.cellNumSelected]}>
                    {number}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.leaveBtn} onPress={resetGame}>
          <Text style={styles.leaveBtnText}>← Leave Game</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  menuContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FF6B9D',
    marginBottom: 10,
    textAlign: 'center',
  },
  menuSubtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  menuButton: {
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    marginVertical: 10,
    minWidth: 280,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiButton: {
    backgroundColor: '#4ECDC4',
  },
  multiButton: {
    backgroundColor: '#FF6B9D',
  },
  joinButton: {
    backgroundColor: '#FFB6C1',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '80%',
  },
  dividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#FFB6C1',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#FFB6C1',
    fontWeight: 'bold',
  },
  input: {
    borderWidth: 3,
    borderColor: '#FFB6C1',
    borderRadius: 20,
    padding: 18,
    fontSize: 20,
    minWidth: 280,
    backgroundColor: '#fff',
    textAlign: 'center',
    marginBottom: 10,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingEmoji: {
    fontSize: 80,
    marginBottom: 20,
  },
  waitingTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FF6B9D',
    marginBottom: 15,
  },
  waitingText: {
    fontSize: 20,
    color: '#FF6B9D',
    marginTop: 20,
  },
  badge: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backBtn: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  backBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  gameOverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameOverEmoji: {
    fontSize: 100,
    marginBottom: 20,
  },
  gameOverTitle: {
    fontSize: 40,
    fontWeight: '900',
    color: '#FF6B9D',
    marginBottom: 10,
  },
  gameOverSub: {
    fontSize: 22,
    color: '#666',
    marginBottom: 30,
  },
  finalScores: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 30,
  },
  scoreCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  scoreLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  playAgainBtn: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  headerLabel: {
    fontSize: 14,
    color: '#999',
  },
  headerValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  turnBox: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  myTurnBox: {
    backgroundColor: '#4ECDC4',
  },
  theirTurnBox: {
    backgroundColor: '#FFB6C1',
  },
  turnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoresBox: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  playerScore: {
    alignItems: 'center',
    flex: 1,
  },
  playerLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 3,
  },
  dotFilled: {
    backgroundColor: '#4ECDC4',
  },
  dotFilledOpp: {
    backgroundColor: '#FF6B9D',
  },
  playerValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFB6C1',
    marginHorizontal: 15,
  },
  boardBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 20,
    maxWidth: 400,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cellWrapper: {
    width: '17%',
    aspectRatio: 1,
    margin: '1.5%',
  },
  cell: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF5F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFB6C1',
  },
  cellSelected: {
    backgroundColor: '#FF6B9D',
    borderColor: '#FF6B9D',
  },
  cellGlow: {
    borderColor: '#FFD700',
    borderWidth: 4,
  },
  cellDisabled: {
    opacity: 0.5,
  },
  cellNum: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  cellNumSelected: {
    color: '#fff',
  },
  leaveBtn: {
    backgroundColor: '#FFB6C1',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 20,
    alignSelf: 'center',
  },
  leaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});