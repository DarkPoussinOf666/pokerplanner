import React, { useEffect, useState, useCallback } from 'react';
import { User, RoomState, VoteValue, EmojiEventPayload, ParticipantVote, CreatedRoomSummary, BacklogItem, DeckType } from './types';
import { getSocket } from './lib/socket';
import { Navbar } from './components/Navbar';
import { PokerTable } from './components/PokerTable';
import { VotingDeck } from './components/VotingDeck';
import { RevealStats } from './components/RevealStats';
import { EmojiBar } from './components/EmojiBar';
import { EmojiOverlay } from './components/EmojiOverlay';
import { HistoryPanel } from './components/HistoryPanel';
import { GoogleAuthModal } from './components/GoogleAuthModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { JoinByCodeModal } from './components/JoinByCodeModal';
import { AvatarCustomizerModal } from './components/AvatarCustomizerModal';
import { CreatedRoomsModal } from './components/CreatedRoomsModal';
import { BacklogModal } from './components/BacklogModal';
import { StatsModal } from './components/StatsModal';
import { ReconnectionModal } from './components/ReconnectionModal';
import { HomePage } from './components/HomePage';
import confetti from 'canvas-confetti';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('scrum_poker_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse user from localStorage', e);
        return null;
      }
    }
    return null;
  });

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [isGoogleAuthOpen, setIsGoogleAuthOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCreatedRoomsOpen, setIsCreatedRoomsOpen] = useState(false);
  const [isBacklogOpen, setIsBacklogOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isJoinByCodeOpen, setIsJoinByCodeOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [activeEmojis, setActiveEmojis] = useState<EmojiEventPayload[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [hasConnectedOnce, setHasConnectedOnce] = useState<boolean>(false);

  // Extract room ID from URL parameters or search
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || '';
  });

  // Local vote memory to prevent vote loss across network glitches or reconnection
  const [localVoteCache, setLocalVoteCache] = useState<{
    roomId?: string;
    storyTitle?: string;
    value?: VoteValue;
    backValue?: VoteValue;
    frontValue?: VoteValue;
  }>(() => {
    try {
      const saved = sessionStorage.getItem('scrum_poker_current_vote_cache');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Save current user to localStorage
  const saveUser = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('scrum_poker_user', JSON.stringify(user));
  };

  // Socket Connection & Event Handling
  useEffect(() => {
    const socket = getSocket();

    const handleRoomState = (state: RoomState) => {
      setRoomState(state);

      // Auto-sync room history to user's created rooms cache if user is host/creator
      const userStr = localStorage.getItem('scrum_poker_user');
      const currentUserLocal = userStr ? JSON.parse(userStr) : null;
      const hostTokenInStorage = state?.id ? localStorage.getItem(`scrum_poker_host_token_${state.id}`) : null;
      const isHostUser = currentUserLocal && state && (
        state.hostId === currentUserLocal.id ||
        state.hostGoogleUid === currentUserLocal.id ||
        (hostTokenInStorage && hostTokenInStorage === state.hostToken)
      );

      if (isHostUser && currentUserLocal) {
        try {
          const key = `scrum_poker_created_rooms_${currentUserLocal.id}`;
          const raw = localStorage.getItem(key);
          let existingRooms: CreatedRoomSummary[] = raw ? JSON.parse(raw) : [];
          const idx = existingRooms.findIndex(r => r.roomId === state.id);
          const updatedSummary: CreatedRoomSummary = {
            roomId: state.id,
            roomName: state.name || `Salle ${state.id}`,
            createdTimestamp: existingRooms[idx]?.createdTimestamp || state.createdTimestamp || Date.now(),
            hostId: state.hostId,
            hostName: state.hostName,
            currentStory: state.currentStory,
            history: state.history || [],
            backlog: state.backlog || []
          };
          if (idx >= 0) {
            existingRooms[idx] = updatedSummary;
          } else {
            existingRooms = [updatedSummary, ...existingRooms].slice(0, 10);
          }
          localStorage.setItem(key, JSON.stringify(existingRooms));
          localStorage.setItem('scrum_poker_created_rooms_guest', JSON.stringify(existingRooms));
        } catch (e) {
          console.error('Failed syncing created rooms to local cache', e);
        }
      }

      // Auto-sync local vote to server if server missed the vote due to network micro-drop
      if (state && !state.isRevealed) {
        try {
          const userObjStr = localStorage.getItem('scrum_poker_user');
          const myUser = userObjStr ? JSON.parse(userObjStr) : null;
          const cacheRaw = sessionStorage.getItem('scrum_poker_current_vote_cache');
          if (myUser && cacheRaw) {
            const cache = JSON.parse(cacheRaw);
            if (cache.roomId === state.id && cache.storyTitle === state.currentStory) {
              const myP = state.participants[myUser.id];
              const missingGlobal = cache.value !== undefined && myP?.value === undefined;
              const missingBack = cache.backValue !== undefined && myP?.backValue === undefined;
              const missingFront = cache.frontValue !== undefined && myP?.frontValue === undefined;

              if ((!myP?.hasVoted || missingGlobal || missingBack || missingFront) && !myP?.isSpectator) {
                socket.emit('vote:submit', {
                  roomId: state.id,
                  userId: myUser.id,
                  value: cache.value,
                  backValue: cache.backValue,
                  frontValue: cache.frontValue
                });
              }
            } else if (cache.roomId === state.id && cache.storyTitle !== state.currentStory) {
              // Story changed, clear old vote cache
              sessionStorage.removeItem('scrum_poker_current_vote_cache');
              setLocalVoteCache({});
            }
          }
        } catch {
          // ignore
        }
      }

      // Check if votes were just revealed and trigger confetti if perfect consensus
      if (state.isRevealed) {
        const votes = Object.values(state.participants)
          .filter(p => p.hasVoted && typeof p.value === 'number')
          .map(p => p.value);

        if (votes.length > 1 && votes.every(v => v === votes[0])) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      }
    };

    const handleEmojiReceived = (payload: EmojiEventPayload) => {
      setActiveEmojis(prev => [...prev, payload]);
      setTimeout(() => {
        setActiveEmojis(prev => prev.filter(e => e.id !== payload.id));
      }, 2500);
    };

    const handleNudge = ({ targetUserId }: { targetUserId: string }) => {
      const userStr = localStorage.getItem('scrum_poker_user');
      const currentUserLocal = userStr ? JSON.parse(userStr) : null;
      if (currentUserLocal && currentUserLocal.id === targetUserId) {
        setToastMessage("Le vote vous attend ! ⏳");
        // Vibrate if supported
        if (navigator.vibrate) {
          navigator.vibrate([200, 100, 200]);
        }
        setTimeout(() => setToastMessage(null), 4000);
      }
    };

    const handleKicked = ({ targetUserId }: { targetUserId: string }) => {
      const userStr = localStorage.getItem('scrum_poker_user');
      const currentUserLocal = userStr ? JSON.parse(userStr) : null;
      if (currentUserLocal && currentUserLocal.id === targetUserId) {
        setToastMessage("Vous avez été exclu de cette salle par l'hôte.");
        setRoomState(null);
        setRoomId('');
        const newUrl = window.location.pathname;
        window.history.pushState({ path: newUrl }, '', newUrl);
        setTimeout(() => setToastMessage(null), 5000);
      }
    };

    const handleHostToken = ({ roomId: rId, hostToken }: { roomId: string; hostToken: string }) => {
      if (rId && hostToken) {
        localStorage.setItem(`scrum_poker_host_token_${rId}`, hostToken);
      }
    };

    const handleRoomNotFound = ({ roomId: notFoundId }: { roomId: string }) => {
      setToastMessage("La salle a été supprimée ou n'existe plus.");
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    };

    const handleErrorToast = ({ message }: { message: string }) => {
      setToastMessage(message);
    };

    socket.on('room:state', handleRoomState);
    socket.on('emoji:received', handleEmojiReceived);
    socket.on('vote:nudge', handleNudge);
    socket.on('user:kicked', handleKicked);
    socket.on('room:host_token', handleHostToken);
    socket.on('room:not_found', handleRoomNotFound);
    socket.on('error:toast', handleErrorToast);

    return () => {
      socket.off('room:state', handleRoomState);
      socket.off('emoji:received', handleEmojiReceived);
      socket.off('vote:nudge', handleNudge);
      socket.off('user:kicked', handleKicked);
      socket.off('room:host_token', handleHostToken);
      socket.off('room:not_found', handleRoomNotFound);
      socket.off('error:toast', handleErrorToast);
    };
  }, []);

  // Join Room via Socket
  const joinRoom = useCallback((targetRoomId: string, userToJoin: User) => {
    const socket = getSocket();
    setRoomId(targetRoomId);

    const savedHostToken = localStorage.getItem(`scrum_poker_host_token_${targetRoomId}`) || userToJoin.hostToken;

    // Update URL without reload
    const newUrl = `${window.location.pathname}?room=${targetRoomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    socket.emit('room:join', {
      roomId: targetRoomId,
      user: userToJoin,
      hostToken: savedHostToken || undefined
    });
  }, []);

  // Handle socket reconnection, offline events, and session heartbeat
  useEffect(() => {
    const socket = getSocket();
    
    if (socket.connected) {
      setIsConnected(true);
      setHasConnectedOnce(true);
    } else {
      // Check active state
      setIsConnected(false);
    }

    // Fallback timer to mark initialization completed
    const initialTimer = setTimeout(() => {
      setHasConnectedOnce(true);
      if (!socket.connected || !navigator.onLine) {
        setIsConnected(false);
      }
    }, 1000);

    const handleConnect = () => {
      console.log('Socket connected successfully');
      setIsConnected(true);
      setHasConnectedOnce(true);
      // Re-join the room if we are already "in" one
      if (roomId && currentUser) {
        console.log('Socket reconnected, re-joining room', roomId);
        const savedHostToken = localStorage.getItem(`scrum_poker_host_token_${roomId}`) || currentUser.hostToken;
        socket.emit('room:join', {
          roomId: roomId,
          user: currentUser,
          hostToken: savedHostToken || undefined,
          isReconnect: true
        });

        // Re-submit local vote on reconnection if vote was submitted prior to drop
        try {
          const cacheRaw = sessionStorage.getItem('scrum_poker_current_vote_cache');
          if (cacheRaw) {
            const cache = JSON.parse(cacheRaw);
            if (cache.roomId === roomId && (cache.value !== undefined || cache.backValue !== undefined || cache.frontValue !== undefined)) {
              socket.emit('vote:submit', {
                roomId: roomId,
                userId: currentUser.id,
                value: cache.value,
                backValue: cache.backValue,
                frontValue: cache.frontValue
              });
            }
          }
        } catch {
          // ignore
        }
      }
    };

    const handleDisconnect = (reason: string) => {
      console.warn('Socket disconnected:', reason);
      setHasConnectedOnce(true);
      setIsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      console.warn('Socket connect_error:', error);
      setHasConnectedOnce(true);
      setIsConnected(false);
    };

    const handleOffline = () => {
      console.warn('Browser offline event triggered');
      setHasConnectedOnce(true);
      setIsConnected(false);
    };

    const handleOnline = () => {
      if (socket.connected) {
        setIsConnected(true);
      } else {
        socket.connect();
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    if (socket.io) {
      socket.io.on('reconnect_error', handleConnectError);
      socket.io.on('reconnect_failed', () => {
        setHasConnectedOnce(true);
        setIsConnected(false);
      });
      socket.io.on('error', handleConnectError);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    
    // Heartbeat to ensure server still has our session state & connection is responsive
    const heartbeatInterval = setInterval(() => {
      if (!navigator.onLine || !socket.connected) {
        setHasConnectedOnce(true);
        setIsConnected(false);
        return;
      }

      if (roomId && currentUser) {
        let responded = false;
        const checkTimeout = setTimeout(() => {
          if (!responded) {
            console.warn('Session check timeout (no server response within 3s)');
            setHasConnectedOnce(true);
            setIsConnected(false);
          }
        }, 3000);

        socket.emit('session:check', { roomId, userId: currentUser.id }, (res: { status: string }) => {
          responded = true;
          clearTimeout(checkTimeout);
          if (res && res.status !== 'ok') {
            console.warn('Session check failed, forcing re-join:', res.status);
            const savedHostToken = localStorage.getItem(`scrum_poker_host_token_${roomId}`) || currentUser.hostToken;
            socket.emit('room:join', {
              roomId: roomId,
              user: currentUser,
              hostToken: savedHostToken || undefined,
              isReconnect: true
            });
          }
        });
      }
    }, 5000);

    return () => {
      clearTimeout(initialTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      if (socket.io) {
        socket.io.off('reconnect_error', handleConnectError);
      }
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      clearInterval(heartbeatInterval);
    };
  }, [roomId, currentUser]);

  // Check room status on load or URL change
  useEffect(() => {
    if (roomId && currentUser) {
      joinRoom(roomId, currentUser);
      setIsJoinModalOpen(false);
    } else if (roomId && !currentUser) {
      setIsJoinModalOpen(true);
    }
  }, [roomId, currentUser, joinRoom]);

  const getHostToken = useCallback((targetRoomId?: string) => {
    const rId = targetRoomId || roomId;
    if (!rId) return undefined;
    return localStorage.getItem(`scrum_poker_host_token_${rId}`) || currentUser?.hostToken || undefined;
  }, [roomId, currentUser]);

  // Create a new Room (Requires Google Auth)
  const handleCreateNewRoom = () => {
    if (!currentUser?.isGoogleAuth) {
      setIsGoogleAuthOpen(true);
      return;
    }

    const newRoomCode = `scrum-${Math.random().toString(36).substring(2, 7)}`;
    const newHostToken = `htoken-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(`scrum_poker_host_token_${newRoomCode}`, newHostToken);

    const creatorUser: User = {
      ...currentUser,
      isHost: true,
      hostToken: newHostToken
    };

    saveUser(creatorUser);

    // Record new room in created rooms cache
    try {
      const key = `scrum_poker_created_rooms_${creatorUser.id}`;
      const existingRaw = localStorage.getItem(key);
      let existingRooms: CreatedRoomSummary[] = existingRaw ? JSON.parse(existingRaw) : [];
      const newRoomSummary: CreatedRoomSummary = {
        roomId: newRoomCode,
        roomName: `Salle ${newRoomCode}`,
        createdTimestamp: Date.now(),
        hostId: creatorUser.id,
        hostName: creatorUser.name,
        currentStory: 'US-01: Ma première User Story',
        history: []
      };
      existingRooms = [newRoomSummary, ...existingRooms.filter(r => r.roomId !== newRoomCode)].slice(0, 10);
      localStorage.setItem(key, JSON.stringify(existingRooms));
    } catch (e) {
      console.error('Failed caching created room', e);
    }

    joinRoom(newRoomCode, creatorUser);
  };

  // Join Room via entered Code
  const handleJoinByCode = useCallback((enteredCode: string) => {
    let raw = enteredCode.trim();
    if (!raw) return;

    if (raw.includes('room=')) {
      try {
        const urlParams = new URLSearchParams(raw.split('?')[1] || '');
        const extracted = urlParams.get('room');
        if (extracted) raw = extracted;
      } catch (e) {}
    }

    let cleanCode = raw.toLowerCase();
    if (!cleanCode.startsWith('scrum-') && !cleanCode.includes('-')) {
      cleanCode = `scrum-${cleanCode}`;
    }

    setRoomId(cleanCode);
    if (currentUser) {
      joinRoom(cleanCode, currentUser);
    } else {
      setIsJoinModalOpen(true);
    }
  }, [currentUser, joinRoom]);

  // Estimation Mode Toggle
  const handleToggleEstimationMode = (mode: 'GLOBAL' | 'DUAL') => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('estimation_mode:toggle', {
      roomId: roomState.id,
      mode
    });
    setToastMessage(`Mode d'estimation passé à : ${mode === 'DUAL' ? 'Double Vote (Back/Front)' : 'Vote Unique Global'} ⚡`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Vote Submission
  const handleSelectVote = (val: VoteValue, dimension: 'GLOBAL' | 'BACK' | 'FRONT' = 'GLOBAL') => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();

    const currentParticipant = roomState.participants[currentUser.id];
    let value = currentParticipant?.value ?? (localVoteCache.roomId === roomState.id && localVoteCache.storyTitle === roomState.currentStory ? localVoteCache.value : undefined);
    let backValue = currentParticipant?.backValue ?? (localVoteCache.roomId === roomState.id && localVoteCache.storyTitle === roomState.currentStory ? localVoteCache.backValue : undefined);
    let frontValue = currentParticipant?.frontValue ?? (localVoteCache.roomId === roomState.id && localVoteCache.storyTitle === roomState.currentStory ? localVoteCache.frontValue : undefined);

    if (dimension === 'BACK') {
      backValue = val;
    } else if (dimension === 'FRONT') {
      frontValue = val;
    } else {
      value = val;
    }

    const updatedVote = {
      roomId: roomState.id,
      storyTitle: roomState.currentStory,
      value,
      backValue,
      frontValue
    };

    setLocalVoteCache(updatedVote);
    try {
      sessionStorage.setItem('scrum_poker_current_vote_cache', JSON.stringify(updatedVote));
    } catch {
      // ignore
    }

    socket.emit('vote:submit', {
      roomId: roomState.id,
      userId: currentUser.id,
      value,
      backValue,
      frontValue
    });
  };

  // Host Actions
  const handleRevealVotes = () => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('vote:reveal', {
      roomId: roomState.id,
      userId: currentUser.id,
      hostToken: getHostToken()
    });
  };

  const handleResetVotes = (nextStoryTitle?: string) => {
    if (!roomState || !currentUser) return;
    // Clear local vote cache on vote reset
    try {
      sessionStorage.removeItem('scrum_poker_current_vote_cache');
      setLocalVoteCache({});
    } catch {
      // ignore
    }
    const socket = getSocket();
    socket.emit('vote:reset', {
      roomId: roomState.id,
      userId: currentUser.id,
      nextStoryTitle,
      hostToken: getHostToken()
    });
  };

  const handleUpdateStoryTitle = (newTitle: string) => {
    if (!roomState) return;
    const socket = getSocket();
    socket.emit('story:update', {
      roomId: roomState.id,
      storyTitle: newTitle
    });
  };

  const handleUpdateBacklog = (newBacklog: BacklogItem[]) => {
    if (!roomState) return;
    const socket = getSocket();
    socket.emit('backlog:update', {
      roomId: roomState.id,
      backlog: newBacklog
    });
  };

  const handleSelectBacklogStory = (storyTitle: string) => {
    if (!roomState) return;
    const socket = getSocket();
    socket.emit('story:select_from_backlog', {
      roomId: roomState.id,
      storyTitle
    });
    setToastMessage(`Story changée : "${storyTitle}" 🚀`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleArbitrateHistoryItem = (
    historyId: string,
    finalScore?: VoteValue,
    backFinalScore?: VoteValue,
    frontFinalScore?: VoteValue
  ) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('history:arbitrate', {
      roomId: roomState.id,
      userId: currentUser.id,
      historyId,
      finalScore,
      backFinalScore,
      frontFinalScore,
      hostToken: getHostToken()
    });
    const label = finalScore !== undefined
      ? `${finalScore} SP`
      : (backFinalScore !== undefined || frontFinalScore !== undefined ? 'Back/Front' : 'mis à jour');
    setToastMessage(`Consensus fixé : ${label} 👑`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUpdateRoomName = (newName: string) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('room:update_name', {
      roomId: roomState.id,
      userId: currentUser.id,
      name: newName,
      hostToken: getHostToken()
    });
    setToastMessage("Nom de la salle mis à jour ! ✏️");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleNudgeUser = (targetUserId: string) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('vote:nudge', {
      roomId: roomState.id,
      targetUserId
    });
  };

  const handleKickUser = (targetUserId: string) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('user:kick', {
      roomId: roomState.id,
      hostUserId: currentUser.id,
      targetUserId,
      hostToken: getHostToken()
    });
  };

  const handleThrowEmoji = (emoji: string, clientX: number, clientY: number) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    
    // We pass the percentage to make it responsive for other clients
    const xPct = (clientX / window.innerWidth) * 100;
    const yPct = (clientY / window.innerHeight) * 100;

    socket.emit('emoji:throw', {
      roomId: roomState.id,
      emoji,
      senderName: currentUser.name,
      x: xPct,
      y: yPct
    });
  };

  const handleToggleSpectator = () => {
    if (!roomState || !currentUser) return;
    const currentSpectatorStatus = roomState.participants[currentUser.id]?.isSpectator || false;
    const newSpectatorStatus = !currentSpectatorStatus;

    const socket = getSocket();
    socket.emit('user:toggle_spectator', {
      roomId: roomState.id,
      userId: currentUser.id,
      isSpectator: newSpectatorStatus
    });

    const updatedUser = { ...currentUser, isSpectator: newSpectatorStatus };
    saveUser(updatedUser);
    setToastMessage(newSpectatorStatus ? "Mode Spectateur activé 👁️" : "Mode Votant activé 🗳️");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleClearHistory = () => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('history:clear', {
      roomId: roomState.id,
      userId: currentUser.id,
      hostToken: getHostToken()
    });
  };

  const handleDeleteHistoryItems = (historyIds: string[]) => {
    if (!roomState || !currentUser || historyIds.length === 0) return;
    const socket = getSocket();
    socket.emit('history:delete_items', {
      roomId: roomState.id,
      userId: currentUser.id,
      historyIds,
      hostToken: getHostToken()
    });
  };

  const handleUpdateUser = (updates: Partial<User>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updates };
    saveUser(updatedUser);
    setCurrentUser(updatedUser);
    
    if (roomState) {
      const socket = getSocket();
      socket.emit('user:update', {
        roomId: roomState.id,
        userId: currentUser.id,
        updates
      });
    }

    setToastMessage("Profil mis à jour ! ✨");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleResetTimer = useCallback(() => {
    if (roomState) {
      const socket = getSocket();
      socket.emit('timer:reset', { roomId: roomState.id });
    }
  }, [roomState]);

  const handleStartSession = useCallback(() => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('session:start', {
      roomId: roomState.id,
      userId: currentUser.id,
      hostToken: getHostToken()
    });
    setToastMessage("La session de chiffrage a démarré ! ⏱️");
    setTimeout(() => setToastMessage(null), 3000);
  }, [roomState, currentUser, getHostToken]);

  const handleStopSession = useCallback(() => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('session:stop', {
      roomId: roomState.id,
      userId: currentUser.id,
      hostToken: getHostToken()
    });
    setToastMessage("Session mise en pause ⏸️");
    setTimeout(() => setToastMessage(null), 3000);
  }, [roomState, currentUser, getHostToken]);

  const handleChangeDeckType = (deckType: DeckType, customValues?: VoteValue[]) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('deck:change', {
      roomId: roomState.id,
      userId: currentUser.id,
      deckType,
      deckValues: customValues,
      hostToken: getHostToken()
    });
    setToastMessage(deckType === 'custom' ? 'Échelle personnalisée appliquée ✨' : `Échelle mise à jour : ${deckType}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfigTimer = (durationSeconds: number, autoReveal: boolean) => {
    if (!roomState || !currentUser) return;
    const socket = getSocket();
    socket.emit('timer:config', {
      roomId: roomState.id,
      userId: currentUser.id,
      durationSeconds,
      autoReveal,
      hostToken: getHostToken()
    });
    setToastMessage("Minuteur configuré");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleGoogleSignIn = (googleUser: User) => {
    saveUser(googleUser);
    if (roomId) {
      joinRoom(roomId, googleUser);
    } else {
      // Auto create a room after Google Sign-In
      const newRoomCode = `scrum-${Math.random().toString(36).substring(2, 7)}`;
      const newHostToken = `htoken-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem(`scrum_poker_host_token_${newRoomCode}`, newHostToken);

      joinRoom(newRoomCode, { ...googleUser, isHost: true, hostToken: newHostToken });
    }
  };

  // Keyboard shortcuts handler (R: reveal, S: reset, 0-9: vote)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing inside input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Ignore if modals are open
      if (isGoogleAuthOpen || isHistoryOpen || isJoinModalOpen || isCustomizerOpen) {
        return;
      }

      if (!roomState || !currentUser) return;

      const isHost = currentUser.id === roomState.hostId;
      const keyUpper = e.key.toUpperCase();

      // 'R' -> Reveal votes (if host and votes are not revealed yet)
      if (keyUpper === 'R') {
        if (isHost && !roomState.isRevealed) {
          const participantsList = Object.values(roomState.participants) as ParticipantVote[];
          const votedCount = participantsList.filter((p) => p.hasVoted).length;
          if (votedCount > 0) {
            e.preventDefault();
            handleRevealVotes();
          }
        }
        return;
      }

      // 'S' -> Reset / Restart votes (if host and votes are revealed)
      if (keyUpper === 'S') {
        if (isHost && roomState.isRevealed) {
          e.preventDefault();
          handleResetVotes();
        }
        return;
      }

      // Digits 0-9 -> Select voting card (when round is active)
      if (!roomState.isRevealed && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const digitMap: Record<string, VoteValue> = {
          '0': 0,
          '1': 1,
          '2': 2,
          '3': 3,
          '4': 0.5,
          '5': 5,
          '6': 13,
          '7': 21,
          '8': 8,
          '9': 34
        };
        const val = digitMap[e.key];
        if (val !== undefined) {
          handleSelectVote(val);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    roomState,
    currentUser,
    isGoogleAuthOpen,
    isHistoryOpen,
    isJoinModalOpen,
    isCustomizerOpen
  ]);

  const isMatchingStory = Boolean(roomState && localVoteCache.roomId === roomState.id && localVoteCache.storyTitle === roomState.currentStory);
  const myVote = (currentUser && roomState?.participants[currentUser.id]?.value) ?? (isMatchingStory && !roomState?.isRevealed ? localVoteCache.value : undefined);
  const myBackVote = (currentUser && roomState?.participants[currentUser.id]?.backValue) ?? (isMatchingStory && !roomState?.isRevealed ? localVoteCache.backValue : undefined);
  const myFrontVote = (currentUser && roomState?.participants[currentUser.id]?.frontValue) ?? (isMatchingStory && !roomState?.isRevealed ? localVoteCache.frontValue : undefined);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Real-time Emoji Floating Canvas */}
      <EmojiOverlay emojis={activeEmojis} />

      {/* Navigation Header */}
      <Navbar
        roomState={roomState}
        currentUser={currentUser}
        isConnected={isConnected}
        onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onCreateNewRoom={handleCreateNewRoom}
        onOpenJoinByCode={() => setIsJoinByCodeOpen(true)}
        onOpenCustomizer={() => setIsCustomizerOpen(true)}
        onOpenCreatedRooms={() => setIsCreatedRoomsOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onUpdateRoomName={handleUpdateRoomName}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-between py-4">
        {roomState ? (
          <>
            {/* Central Poker Table */}
            <PokerTable
              roomState={roomState}
              currentUser={currentUser}
              onRevealVotes={handleRevealVotes}
              onResetVotes={handleResetVotes}
              onUpdateStoryTitle={handleUpdateStoryTitle}
              onToggleEstimationMode={handleToggleEstimationMode}
              onNudgeUser={handleNudgeUser}
              onKickUser={handleKickUser}
              selectedEmoji={selectedEmoji}
              onThrowEmoji={handleThrowEmoji}
              onResetTimer={handleResetTimer}
              onConfigTimer={handleConfigTimer}
              onOpenBacklog={() => setIsBacklogOpen(true)}
              onSelectBacklogStory={handleSelectBacklogStory}
              onStartSession={handleStartSession}
              onStopSession={handleStopSession}
            />

            {/* Revealed Vote Analytics or Voting Cards Deck */}
            {roomState.isRevealed ? (
              <RevealStats
                deckType={roomState.deckType || 'fibonacci'}
                deckValues={roomState.deckValues}
                estimationMode={roomState.estimationMode}
                participants={roomState.participants}
                currentStory={roomState.currentStory}
                isHost={Boolean(currentUser && (currentUser.id === roomState.hostId || roomState.participants[currentUser.id]?.isHost))}
                currentHistoryItem={roomState.history[0]}
                onArbitrate={handleArbitrateHistoryItem}
              />
            ) : (
              <VotingDeck
                deckType={roomState.deckType || 'fibonacci'}
                deckValues={roomState.deckValues}
                onChangeDeckType={handleChangeDeckType}
                estimationMode={roomState.estimationMode}
                selectedVote={myVote}
                selectedBackVote={myBackVote}
                selectedFrontVote={myFrontVote}
                onSelectVote={handleSelectVote}
                isRevealed={roomState.isRevealed}
                disabled={!currentUser}
                isSpectator={Boolean(currentUser && roomState.participants[currentUser.id]?.isSpectator)}
                onToggleSpectator={handleToggleSpectator}
                isHost={Boolean(currentUser && (currentUser.id === roomState.hostId || roomState.participants[currentUser.id]?.isHost))}
                onToggleEstimationMode={handleToggleEstimationMode}
              />
            )}

            {/* Fun Emoji Selector Bar */}
            <EmojiBar selectedEmoji={selectedEmoji} onSelectEmoji={setSelectedEmoji} />
          </>
        ) : (
          /* Faithful, sober, and airy Home Page component */
          <HomePage
            currentUser={currentUser}
            onCreateRoom={handleCreateNewRoom}
            onJoinByCode={handleJoinByCode}
            onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
            onOpenCreatedRooms={() => setIsCreatedRoomsOpen(true)}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
          />
        )}
      </main>

      {/* Modals & Slide-overs */}
      <GoogleAuthModal
        isOpen={isGoogleAuthOpen}
        onClose={() => setIsGoogleAuthOpen(false)}
        currentUser={currentUser}
        onGoogleSignIn={handleGoogleSignIn}
        onSignOut={() => {
          setCurrentUser(null);
          localStorage.removeItem('scrum_poker_user');
        }}
      />

      <JoinByCodeModal
        isOpen={isJoinByCodeOpen}
        onClose={() => setIsJoinByCodeOpen(false)}
        onSubmitCode={handleJoinByCode}
      />

      <JoinRoomModal
        isOpen={isJoinModalOpen}
        roomId={roomId}
        roomHostName={roomState?.hostName}
        onJoin={(user) => {
          saveUser(user);
          joinRoom(roomId, user);
          setIsJoinModalOpen(false);
        }}
        onOpenGoogleAuth={() => {
          setIsJoinModalOpen(false);
          setIsGoogleAuthOpen(true);
        }}
      />

      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={roomState?.history || []}
        isHost={Boolean(currentUser && (currentUser.id === roomState?.hostId || roomState?.participants[currentUser.id]?.isHost))}
        onClearHistory={handleClearHistory}
        onDeleteHistoryItems={handleDeleteHistoryItems}
        onOpenCreatedRooms={() => setIsCreatedRoomsOpen(true)}
        onOpenStats={() => setIsStatsOpen(true)}
        onArbitrate={handleArbitrateHistoryItem}
      />

      <StatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        history={roomState?.history || []}
        roomState={roomState}
        emojiStats={roomState?.emojiStats}
      />

      <CreatedRoomsModal
        isOpen={isCreatedRoomsOpen}
        onClose={() => setIsCreatedRoomsOpen(false)}
        currentUser={currentUser}
        onJoinRoom={(targetCode) => handleJoinByCode(targetCode)}
        onOpenGoogleAuth={() => setIsGoogleAuthOpen(true)}
        onCreateNewRoom={handleCreateNewRoom}
      />

      <BacklogModal
        isOpen={isBacklogOpen}
        onClose={() => setIsBacklogOpen(false)}
        backlog={roomState?.backlog || []}
        currentStory={roomState?.currentStory || ''}
        history={roomState?.history || []}
        isHost={Boolean(currentUser && (currentUser.id === roomState?.hostId || roomState?.participants[currentUser.id]?.isHost))}
        onUpdateBacklog={handleUpdateBacklog}
        onSelectAndStartStory={handleSelectBacklogStory}
      />
      
      {currentUser && (
        <AvatarCustomizerModal
          isOpen={isCustomizerOpen}
          user={currentUser}
          onClose={() => setIsCustomizerOpen(false)}
          onSave={handleUpdateUser}
        />
      )}
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top fade-in duration-300">
          <div className="bg-[#1A1D23] border border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/20 text-white px-6 py-3 rounded-full font-bold flex items-center gap-3">
            <span className="text-xl">👋</span>
            {toastMessage}
          </div>
        </div>
      )}

      {/* Reconnection Overlay Modal */}
      <ReconnectionModal isOpen={!isConnected} />
    </div>
  );
}
