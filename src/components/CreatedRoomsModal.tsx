import React, { useState, useEffect } from 'react';
import { User, CreatedRoomSummary, HistoryItem } from '../types';
import {
  X,
  FolderClock,
  LogIn,
  ArrowRight,
  Clock,
  Calculator,
  Search,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PlusCircle,
  ExternalLink,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react';

interface CreatedRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onJoinRoom: (roomId: string) => void;
  onOpenGoogleAuth: () => void;
  onCreateNewRoom: () => void;
}

const formatDuration = (totalSecs?: number) => {
  if (totalSecs === undefined || totalSecs === null) return '-';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const formatDate = (timestamp: number) => {
  if (!timestamp) return 'Date inconnue';
  const date = new Date(timestamp);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const CreatedRoomsModal: React.FC<CreatedRoomsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onJoinRoom,
  onOpenGoogleAuth,
  onCreateNewRoom
}) => {
  const [rooms, setRooms] = useState<CreatedRoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedRoomIds([]);

    const fetchCreatedRooms = async () => {
      setIsLoading(true);
      try {
        const roomMap: Record<string, CreatedRoomSummary> = {};

        // 1. Read from guest local storage
        try {
          const rawGuest = localStorage.getItem('scrum_poker_created_rooms_guest');
          if (rawGuest) {
            const guestRooms: CreatedRoomSummary[] = JSON.parse(rawGuest);
            guestRooms.forEach(room => {
              if (room.roomId) roomMap[room.roomId] = room;
            });
          }
        } catch (e) {
          console.error('Error parsing guest created rooms', e);
        }

        // 2. Read from user-specific local storage
        if (currentUser?.id) {
          try {
            const rawLocal = localStorage.getItem(`scrum_poker_created_rooms_${currentUser.id}`);
            if (rawLocal) {
              const localRooms: CreatedRoomSummary[] = JSON.parse(rawLocal);
              localRooms.forEach(room => {
                if (room.roomId) roomMap[room.roomId] = room;
              });
            }
          } catch (e) {
            console.error('Error parsing user local created rooms', e);
          }
        }

        // 3. Fetch from API if user has ID
        if (currentUser?.id) {
          try {
            const res = await fetch(`/api/users/${currentUser.id}/created-rooms`);
            if (res.ok) {
              const data = await res.json();
              const apiRooms: CreatedRoomSummary[] = data.createdRooms || [];
              apiRooms.forEach(room => {
                if (!room.roomId) return;
                // Preserve local history if richer
                if (roomMap[room.roomId]) {
                  const localHist = roomMap[room.roomId].history || [];
                  const apiHist = room.history || [];
                  const histMap = new Map();
                  [...localHist, ...apiHist].forEach(h => {
                    if (h.id) histMap.set(h.id, h);
                  });
                  room.history = Array.from(histMap.values());
                }
                roomMap[room.roomId] = room;
              });
            }
          } catch (e) {
            console.error('Error fetching created rooms from server', e);
          }
        }

        const now = Date.now();
        const MAX_ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

        const mergedList = Object.values(roomMap).filter(room => {
          const expireAt = room.expireAtMs || (room.createdTimestamp ? room.createdTimestamp + MAX_ROOM_TTL_MS : null);
          return !expireAt || expireAt > now;
        });

        mergedList.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
        const top10 = mergedList.slice(0, 10);

        setRooms(top10);

        if (currentUser?.id) {
          localStorage.setItem(`scrum_poker_created_rooms_${currentUser.id}`, JSON.stringify(top10));
        }
        localStorage.setItem('scrum_poker_created_rooms_guest', JSON.stringify(top10));
      } catch (err) {
        console.error('Failed to load created rooms', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCreatedRooms();
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const isAuthenticated = currentUser?.isGoogleAuth;

  const filteredRooms = rooms.filter(r =>
    r.roomId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.roomName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.history?.some(h => h.storyTitle.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleExpand = (roomId: string) => {
    setExpandedRoomId(prev => (prev === roomId ? null : roomId));
  };

  const handleToggleSelectRoom = (roomId: string) => {
    setSelectedRoomIds(prev =>
      prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedRoomIds.length === filteredRooms.length) {
      setSelectedRoomIds([]);
    } else {
      setSelectedRoomIds(filteredRooms.map(r => r.roomId));
    }
  };

  const handleDeleteRooms = async (roomIdsToDelete: string[]) => {
    if (roomIdsToDelete.length === 0) return;

    if (currentUser?.id) {
      try {
        await fetch(`/api/users/${currentUser.id}/created-rooms`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomIds: roomIdsToDelete })
        });
      } catch (e) {
        console.error('Failed to delete rooms on server', e);
      }
    }

    const updated = rooms.filter(r => !roomIdsToDelete.includes(r.roomId));
    setRooms(updated);
    setSelectedRoomIds(prev => prev.filter(id => !roomIdsToDelete.includes(id)));

    if (currentUser?.id) {
      localStorage.setItem(`scrum_poker_created_rooms_${currentUser.id}`, JSON.stringify(updated));
    }
    localStorage.setItem('scrum_poker_created_rooms_guest', JSON.stringify(updated));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#14171D] border border-[#242933] text-[#E2E8F0] w-full max-w-2xl max-h-[85vh] rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative">
        {/* Header */}
        <div className="shrink-0 pb-4 border-b border-[#242933]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <FolderClock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Mes Salles Créées
                  <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold px-2 py-0.5 rounded-full">
                    Max 10
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Consultez vos 10 dernières salles, l'historique de leurs votes et rejoignez-les en 1 clic.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-[#1A1D23] hover:bg-[#242933] transition-colors border border-[#242933]"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar & Selection controls */}
          {rooms.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Rechercher par code de salle ou User Story..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0B0D10] border border-[#242933] focus:border-purple-500 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {selectedRoomIds.length > 0 && selectedRoomIds.length === filteredRooms.length ? (
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  <span>
                    {selectedRoomIds.length > 0 && selectedRoomIds.length === filteredRooms.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </span>
                </button>

                {selectedRoomIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRooms(selectedRoomIds)}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Supprimer ({selectedRoomIds.length})</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Guest sync notice banner */}
        {!isAuthenticated && (
          <div className="mt-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2 text-purple-300">
              <LogIn className="w-4 h-4 shrink-0 text-purple-400" />
              <span>Salles enregistrées localement sur ce navigateur. Connectez-vous avec Google pour les conserver partout.</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenGoogleAuth();
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors cursor-pointer shrink-0 text-[11px]"
            >
              Se connecter
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-3 custom-scrollbar">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs">Chargement de votre historique de salles...</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12 px-4 bg-[#1A1D23]/40 border border-[#242933] rounded-2xl">
              <FolderClock className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-40" />
              <h4 className="text-sm font-bold text-slate-300">Aucune salle trouvée</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {searchTerm
                  ? 'Aucune salle ne correspond à votre recherche.'
                  : 'Vous n\'avez pas encore créé de salle. Créez votre première salle pour enregistrer ses votes !'}
              </p>
              <button
                onClick={() => {
                  onClose();
                  onCreateNewRoom();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Créer une Nouvelle Salle
              </button>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isExpanded = expandedRoomId === room.roomId;
              const hasHistory = room.history && room.history.length > 0;
              const isSelected = selectedRoomIds.includes(room.roomId);

              return (
                <div
                  key={room.roomId}
                  className={`border rounded-xl p-4 transition-all shadow-md ${
                    isSelected
                      ? 'bg-purple-950/20 border-purple-500/60 ring-1 ring-purple-500/40'
                      : 'bg-[#1A1D23] border-[#242933] hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSelectRoom(room.roomId)}
                        className="mt-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title={isSelected ? 'Désélectionner cette salle' : 'Sélectionner cette salle'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-purple-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-600" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-white truncate max-w-[200px]" title={room.roomName || room.roomId}>
                            {room.roomName || room.roomId}
                          </span>
                          <span className="font-mono text-[10px] font-bold bg-purple-500/15 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded-md">
                            {room.roomId}
                          </span>
                          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Créée le {formatDate(room.createdTimestamp)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-300 mt-1">
                          <span className="font-medium text-slate-400">Total US :</span>
                          <span className="font-bold text-white bg-[#0B0D10] border border-[#242933] px-2 py-0.5 rounded-md">
                            {(room.history?.length || 0) + (room.backlog?.filter(b => b.estimatedScore === undefined || b.estimatedScore === null).length || 0)}
                          </span>
                          <span className="font-medium text-slate-400 ml-1">dont votées :</span>
                          <span className="font-bold text-white bg-[#0B0D10] border border-[#242933] px-2 py-0.5 rounded-md">
                            {room.history?.length || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {hasHistory && (
                        <button
                          onClick={() => toggleExpand(room.roomId)}
                          className="px-3 py-2 bg-[#0B0D10] hover:bg-[#242933] border border-[#242933] text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>Votes ({room.history.length})</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteRooms([room.roomId])}
                        className="p-2 text-slate-400 hover:text-rose-400 rounded-xl bg-[#0B0D10] hover:bg-rose-500/10 border border-[#242933] transition-colors cursor-pointer"
                        title="Supprimer cette salle"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          onClose();
                          onJoinRoom(room.roomId);
                        }}
                        className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-950/40 flex items-center gap-1.5 cursor-pointer group"
                      >
                        <span>Rejoindre</span>
                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Votes Accordion */}
                  {isExpanded && hasHistory && (
                    <div className="mt-4 pt-3 border-t border-[#242933] space-y-2.5 animate-in fade-in duration-200">
                      <h5 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        Historique des votes de cette salle
                      </h5>

                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                        {room.history.map((item) => {
                          const isDual = item.estimationMode === 'DUAL';
                          return (
                            <div
                              key={item.id}
                              className="bg-[#0B0D10] border border-[#242933] rounded-lg p-3 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="font-bold text-white line-clamp-1">{item.storyTitle}</span>
                                <span className="text-[10px] text-slate-500 shrink-0 font-mono">{item.timestamp}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2.5 text-[11px] mb-2 text-slate-300">
                                {isDual ? (
                                  <>
                                    <span className="bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-300">
                                      Back: <strong>{item.backFinalScore ?? item.backMode ?? item.backAverage ?? '-'}</strong>
                                    </span>
                                    <span className="bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-emerald-300">
                                      Front: <strong>{item.frontFinalScore ?? item.frontMode ?? item.frontAverage ?? '-'}</strong>
                                    </span>
                                    <span className="bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded text-purple-200">
                                      Score Final: <strong>{item.finalScore ?? '-'}</strong>
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span>Moyenne: <strong className="text-blue-400 font-bold">{item.average ?? '-'}</strong></span>
                                    <span>Mode: <strong className="text-purple-400 font-bold">{item.mode ?? '-'}</strong></span>
                                    {item.finalScore !== undefined && item.finalScore !== null && (
                                      <span className="bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded text-purple-200">
                                        Score: <strong>{item.finalScore}</strong>
                                      </span>
                                    )}
                                  </>
                                )}
                                <span className="text-slate-400">Votes: <strong className="text-emerald-400 font-bold">{item.totalVotes}</strong></span>
                                {item.durationSeconds !== undefined && (
                                  <span className="text-slate-500">Durée: {formatDuration(item.durationSeconds)}</span>
                                )}
                              </div>

                              {item.votes && item.votes.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-[#1C2029]">
                                  {item.votes.map((v, idx) => {
                                    const voteText = isDual
                                      ? `Back: ${v.backValue ?? '-'} | Front: ${v.frontValue ?? '-'}`
                                      : String(v.value ?? '-');
                                    return (
                                      <span
                                        key={idx}
                                        className="text-[10px] bg-[#14171D] border border-[#242933] px-2 py-0.5 rounded text-slate-300"
                                      >
                                        {v.userName}: <strong className="text-white">{voteText}</strong>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-3 border-t border-[#242933] flex items-center justify-between text-xs text-slate-500">
          <span>{rooms.length} salle{rooms.length > 1 ? 's' : ''} enregistrée{rooms.length > 1 ? 's' : ''}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#1A1D23] hover:bg-[#242933] text-slate-300 hover:text-white rounded-xl font-semibold transition-colors border border-[#242933] cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
