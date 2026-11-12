import React, { useState, useEffect } from 'react';
import { User, RoomState } from '../types';
import {
  Share2,
  Check,
  History,
  ShieldCheck,
  PlusCircle,
  Sparkles,
  Users,
  LogIn,
  FolderClock,
  Pencil,
  X,
  BarChart3,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AvatarDisplay } from './AvatarDisplay';

interface NavbarProps {
  roomState: RoomState | null;
  currentUser: User | null;
  isConnected?: boolean;
  onOpenGoogleAuth: () => void;
  onOpenHistory: () => void;
  onCreateNewRoom: () => void;
  onOpenJoinByCode?: () => void;
  onOpenCustomizer?: () => void;
  onOpenCreatedRooms?: () => void;
  onOpenStats?: () => void;
  onUpdateRoomName?: (newName: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  roomState,
  currentUser,
  isConnected = true,
  onOpenGoogleAuth,
  onOpenHistory,
  onCreateNewRoom,
  onOpenJoinByCode,
  onOpenCustomizer,
  onOpenCreatedRooms,
  onOpenStats,
  onUpdateRoomName
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');

  useEffect(() => {
    if (roomState) {
      setRoomNameInput(roomState.name || `Salle ${roomState.id}`);
    }
  }, [roomState?.name, roomState?.id]);

  const handleShareRoom = () => {
    if (!roomState) return;
    const url = `${window.location.origin}?room=${roomState.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveRoomName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNameInput.trim()) return;
    if (onUpdateRoomName) {
      onUpdateRoomName(roomNameInput.trim());
    }
    setIsEditingName(false);
  };

  const participantCount = roomState ? Object.keys(roomState.participants || {}).length : 0;
  const historyCount = roomState ? roomState.history?.length || 0 : 0;
  const isHost = Boolean(currentUser && roomState && (currentUser.id === roomState.hostId || roomState.participants[currentUser.id]?.isHost));

  return (
    <header className="sticky top-0 z-40 bg-[#0E1219]/95 backdrop-blur-md border-b border-slate-800 px-3 py-2 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-slate-100 tracking-tight leading-none shrink-0">
                Scrum Poker
              </span>
              <span className="hidden md:inline-block text-[9px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.2 rounded shrink-0">
                Live
              </span>
            </div>
            {roomState && (
              <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 min-w-0">
                {isEditingName ? (
                  <form onSubmit={handleSaveRoomName} className="flex items-center gap-1 shrink-0">
                    <input
                      type="text"
                      value={roomNameInput}
                      onChange={(e) => setRoomNameInput(e.target.value)}
                      className="bg-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white font-medium outline-none"
                      placeholder="Nom de la salle..."
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors cursor-pointer shrink-0"
                      title="Enregistrer"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(false)}
                      className="p-1 bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer shrink-0"
                      title="Annuler"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-slate-300 max-w-[120px] sm:max-w-[180px] truncate" title={roomState.name || `Salle ${roomState.id}`}>
                      {roomState.name || `Salle ${roomState.id}`}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">({roomState.id})</span>
                    {isHost && onUpdateRoomName && (
                      <button
                        onClick={() => {
                          setRoomNameInput(roomState.name || `Salle ${roomState.id}`);
                          setIsEditingName(true);
                        }}
                        className="p-0.5 text-slate-500 hover:text-indigo-400 rounded transition-colors shrink-0 cursor-pointer"
                        title="Renommer la salle"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <span className="hidden sm:inline text-slate-700 shrink-0">•</span>
                <span className="hidden sm:flex items-center gap-1 text-slate-400 text-xs shrink-0">
                  <Users className="w-3 h-3 text-indigo-400" /> {participantCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls Toolbar */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-nowrap overflow-x-auto scrollbar-none py-0.5">
          {roomState && (
            <>
              {/* Share Room Link Button */}
              <button
                onClick={handleShareRoom}
                className={`shrink-0 h-8 px-2.5 flex items-center gap-1.5 rounded-lg font-medium text-xs border transition-colors select-none cursor-pointer ${
                  copied
                    ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                }`}
                title="Copier le lien de la salle"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Share2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                <span className="hidden sm:inline">{copied ? 'Copié' : 'Partager'}</span>
              </button>

              {/* Stats & Charts Button */}
              {onOpenStats && (
                <button
                  onClick={onOpenStats}
                  className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 rounded-lg font-medium text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer select-none"
                  title="Statistiques de la session"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="hidden md:inline">Stats</span>
                </button>
              )}

              {/* History Button */}
              <button
                onClick={onOpenHistory}
                className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 rounded-lg font-medium text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer select-none"
                title="Historique des estimations"
              >
                <History className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="hidden sm:inline">Historique</span>
                {historyCount > 0 && (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0">
                    {historyCount}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Mes Salles Button */}
          {onOpenCreatedRooms && (
            <button
              onClick={onOpenCreatedRooms}
              className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer select-none"
              title="Vos salles créées"
            >
              <FolderClock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Mes Salles</span>
            </button>
          )}

          {/* Join Room By Code Button */}
          {onOpenJoinByCode && (
            <button
              onClick={onOpenJoinByCode}
              className="shrink-0 h-8 px-2.5 flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer select-none"
              title="Rejoindre avec un code"
            >
              <LogIn className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Rejoindre</span>
            </button>
          )}

          {/* Create New Room Button */}
          <button
            onClick={onCreateNewRoom}
            className="shrink-0 h-8 px-3 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer select-none"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Nouvelle Salle</span>
          </button>

          {/* Connection Status Indicator */}
          <div 
            className={`shrink-0 h-8 px-2 flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors select-none ${
              isConnected 
                ? 'bg-slate-900 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse'
            }`}
            title={isConnected ? 'Connecté' : 'Déconnecté'}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 shrink-0" />}
          </div>

          {/* User Profile / Avatar */}
          {currentUser && (
            <button
              onClick={onOpenCustomizer}
              className="shrink-0 h-8 w-8 p-0.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer select-none overflow-hidden"
              title="Personnaliser votre profil"
            >
              <AvatarDisplay user={currentUser} className="w-full h-full text-xs border-0 rounded" />
            </button>
          )}

          {/* Google Auth Button */}
          <button
            onClick={onOpenGoogleAuth}
            className={`shrink-0 h-8 px-2.5 flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer select-none ${
              currentUser?.isGoogleAuth
                ? 'bg-slate-900 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="Authentification Google"
          >
            {currentUser?.isGoogleAuth ? (
              <>
                <span className="hidden xl:inline max-w-[90px] truncate">{currentUser.name}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="hidden sm:inline">Google</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
