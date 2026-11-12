import React, { useState, useEffect, useMemo } from 'react';
import { RoomState, User, ParticipantVote } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Eye,
  RotateCcw,
  Edit3,
  Crown,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Award,
  Bell,
  Loader2,
  Check,
  UserX,
  WifiOff,
  ListTodo,
  Layers,
  Play,
  Square,
  Activity,
  CheckCheck
} from 'lucide-react';
import { AvatarDisplay } from './AvatarDisplay';

interface PokerTableProps {
  roomState: RoomState;
  currentUser: User | null;
  onRevealVotes: () => void;
  onResetVotes: (nextStoryTitle?: string) => void;
  onUpdateStoryTitle: (newTitle: string) => void;
  onToggleEstimationMode?: (mode: 'GLOBAL' | 'DUAL') => void;
  onNudgeUser?: (userId: string) => void;
  onKickUser?: (userId: string) => void;
  selectedEmoji?: string | null;
  onThrowEmoji?: (emoji: string, clientX: number, clientY: number) => void;
  onResetTimer?: () => void;
  onOpenBacklog?: () => void;
  onSelectBacklogStory?: (storyTitle: string) => void;
  onStartSession?: () => void;
  onStopSession?: () => void;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  roomState,
  currentUser,
  onRevealVotes,
  onResetVotes,
  onUpdateStoryTitle,
  onToggleEstimationMode,
  onNudgeUser,
  onKickUser,
  selectedEmoji,
  onThrowEmoji,
  onResetTimer,
  onOpenBacklog,
  onSelectBacklogStory,
  onStartSession,
  onStopSession
}) => {
  const [isEditingStory, setIsEditingStory] = useState(false);
  const [storyInput, setStoryInput] = useState(roomState.currentStory);
  const [isSavingStory, setIsSavingStory] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Stopwatch effect: ticks every second automatically ONLY when session is started by the host
  useEffect(() => {
    if (!roomState.isSessionStarted || !roomState.storyStartTime) {
      setElapsedSeconds(0);
      return;
    }

    const startTime = roomState.storyStartTime;

    const updateElapsed = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(diff);
    };

    updateElapsed();

    if (roomState.isRevealed) {
      return;
    }

    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [roomState.storyStartTime, roomState.isSessionStarted, roomState.isRevealed]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    setStoryInput(roomState.currentStory);
    if (isSavingStory) {
      setIsSavingStory(false);
      setIsEditingStory(false);
      setJustSaved(true);
      const timer = setTimeout(() => setJustSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [roomState.currentStory]);

  const isHost = Boolean(
    currentUser &&
      (currentUser.id === roomState.hostId ||
        (roomState.hostGoogleUid && currentUser.id === roomState.hostGoogleUid) ||
        roomState.participants[currentUser.id]?.isHost)
  );
  const participantsList = (Object.values(roomState.participants || {}) as ParticipantVote[]);
  const votersList = participantsList.filter(p => !p.isSpectator);
  const spectatorsList = participantsList.filter(p => p.isSpectator);
  const totalCount = participantsList.length;
  const totalVotersCount = votersList.length;
  const votedCount = votersList.filter(p => p.hasVoted).length;

  const voteProgressRatio = totalVotersCount > 0 ? votedCount / totalVotersCount : 0;
  const ringRadius = 60;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - voteProgressRatio * ringCircumference;

  // Calculate participant coordinates on SVG canvas (1000 x 560 coordinate space)
  const participantNodes = useMemo(() => {
    return participantsList.map((p, index) => {
      const angle = (index / Math.max(totalCount, 1)) * 2 * Math.PI - Math.PI / 2;
      // Percent coordinates for HTML overlay positioning
      const rxPct = 37;
      const ryPct = 34;
      const leftPct = 50 + rxPct * Math.cos(angle);
      const topPct = 50 + ryPct * Math.sin(angle);

      // Corresponding SVG canvas coordinates in 1000x560 space
      const svgX = 500 + 370 * Math.cos(angle);
      const svgY = 280 + 190 * Math.sin(angle);

      return {
        participant: p,
        index,
        angle,
        leftPct,
        topPct,
        svgX,
        svgY,
        isCurrent: p.userId === currentUser?.id
      };
    });
  }, [participantsList, totalCount, currentUser?.id]);

  const handleStorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = storyInput.trim();
    if (trimmed) {
      if (trimmed !== roomState.currentStory) {
        setIsSavingStory(true);
        onUpdateStoryTitle(trimmed);
      } else {
        setIsEditingStory(false);
      }
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (selectedEmoji && onThrowEmoji) {
      onThrowEmoji(selectedEmoji, e.clientX, e.clientY);
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative w-full max-w-5xl mx-auto px-4 py-3 transition-colors select-none ${
        selectedEmoji ? 'cursor-crosshair' : ''
      }`}
    >
      {/* Story Header Banner - Épuré & Aérien */}
      <div className="bg-[#10141D]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 mb-3.5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 transition-all">
        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* User Story Badge with subtle vector dot */}
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              User Story
            </span>

            {/* Estimation Mode Toggle Badge */}
            <button
              type="button"
              disabled={!isHost}
              onClick={(e) => {
                e.stopPropagation();
                if (isHost && onToggleEstimationMode) {
                  onToggleEstimationMode(roomState.estimationMode === 'DUAL' ? 'GLOBAL' : 'DUAL');
                }
              }}
              className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border transition-colors flex items-center gap-1.5 ${
                roomState.estimationMode === 'DUAL'
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-slate-200'
              } ${isHost ? 'cursor-pointer hover:border-slate-700' : 'cursor-default'}`}
              title={isHost ? "Changer le mode d'estimation (Global / Back & Front)" : "Mode d'estimation"}
            >
              <Layers className="w-3 h-3 text-indigo-400" />
              <span>{roomState.estimationMode === 'DUAL' ? 'Mode Dual' : 'Mode Unique'}</span>
            </button>

            {/* Stopwatch Badge */}
            {roomState.isSessionStarted && roomState.storyStartTime ? (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${
                  roomState.isRevealed
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                }`}
                title={roomState.isRevealed ? "Chronomètre verrouillé" : "Chronomètre en cours"}
              >
                <Clock className={`w-3.5 h-3.5 ${!roomState.isRevealed ? 'text-indigo-400 animate-pulse' : 'text-amber-400'}`} />
                <span className="font-mono text-[11px] tracking-wide">{formatTime(elapsedSeconds)}</span>
                {onResetTimer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onResetTimer();
                    }}
                    className="ml-0.5 p-0.5 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                    title="Remettre à zéro le chronomètre"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                {isHost && onStopSession && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStopSession();
                    }}
                    className="ml-0.5 p-0.5 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer"
                    title="Arrêter la session"
                  >
                    <Square className="w-3 h-3 fill-rose-500/20 text-rose-400" />
                  </button>
                )}
              </div>
            ) : (
              isHost ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartSession) onStartSession();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer"
                  title="Démarrer la session et le chronomètre"
                >
                  <Play className="w-3 h-3 fill-emerald-400 text-emerald-400" />
                  <span>Démarrer</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/80 text-slate-400 border border-slate-800 text-xs font-medium">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>En attente</span>
                </div>
              )
            )}

            {isSavingStory && (
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Enregistrement...
              </span>
            )}
            {justSaved && !isSavingStory && (
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Mis à jour
              </span>
            )}
            {votedCount === totalVotersCount && totalVotersCount > 0 && !roomState.isRevealed && (
              <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                <CheckCircle2 className="w-3 h-3" /> Tous votés
              </span>
            )}
          </div>

          {isEditingStory ? (
            <form onSubmit={handleStorySubmit} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={storyInput}
                  disabled={isSavingStory}
                  onChange={(e) => setStoryInput(e.target.value)}
                  placeholder="Titre de la User Story..."
                  className="w-full bg-[#0A0D14] border border-indigo-500/80 rounded-xl px-3.5 py-1.5 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60 transition-all"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={isSavingStory || !storyInput.trim()}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs disabled:opacity-60 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                Valider
              </button>
              <button
                type="button"
                disabled={isSavingStory}
                onClick={() => {
                  setStoryInput(roomState.currentStory);
                  setIsEditingStory(false);
                }}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium rounded-xl text-xs disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
              >
                Annuler
              </button>
            </form>
          ) : (
            <div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setStoryInput(roomState.currentStory);
                  setIsEditingStory(true);
                }}
                className="flex items-center gap-2 group cursor-pointer"
                title="Modifier le titre"
              >
                <h2 className="text-base sm:text-lg font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors tracking-tight truncate">
                  {roomState.currentStory}
                </h2>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-indigo-400 bg-slate-900/60 hover:bg-slate-800 border border-slate-800/80 rounded-lg transition-colors shrink-0"
                  title="Modifier"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Backlog Quick Dropdown */}
              <div className="flex items-center gap-2 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                {roomState.backlog && roomState.backlog.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-[#0B0E16] border border-slate-800 rounded-lg px-2.5 py-1">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1 shrink-0">
                      <ListTodo className="w-3.5 h-3.5 text-indigo-400" /> Backlog :
                    </span>
                    <select
                      value={roomState.backlog.some(b => b.title === roomState.currentStory) ? roomState.currentStory : ''}
                      onChange={(e) => {
                        const selectedTitle = e.target.value;
                        if (selectedTitle) {
                          if (onSelectBacklogStory) {
                            onSelectBacklogStory(selectedTitle);
                          } else {
                            onResetVotes(selectedTitle);
                          }
                        }
                      }}
                      className="bg-[#121622] text-xs font-semibold text-slate-200 border border-slate-800 rounded px-2 py-0.5 outline-none max-w-[220px] truncate cursor-pointer"
                    >
                      <option value="" disabled>-- Choisir une US --</option>
                      {roomState.backlog.map((item, idx) => {
                        const histMatch = roomState.history?.find(
                          h => h.storyTitle.trim().toLowerCase() === item.title.trim().toLowerCase()
                        );
                        const finalVal = histMatch
                          ? (histMatch.finalScore !== undefined && histMatch.finalScore !== null
                              ? histMatch.finalScore
                              : (histMatch.mode !== null ? histMatch.mode : (histMatch.average !== null ? Math.round(histMatch.average) : null)))
                          : (item.estimatedScore !== undefined && item.estimatedScore !== null ? item.estimatedScore : null);
                        const scoreLabel = finalVal !== null && finalVal !== undefined ? ` [✓ ${finalVal} SP]` : '';
                        return (
                          <option key={item.id} value={item.title}>
                            #{idx + 1}: {item.title}{scoreLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenBacklog) onOpenBacklog();
                  }}
                  className="px-2.5 py-1 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800/90 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ListTodo className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Gérer le Backlog</span>
                  {roomState.backlog && roomState.backlog.length > 0 && (
                    <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                      {roomState.backlog.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Host Control Actions */}
        {isHost && (
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end" onClick={(e) => e.stopPropagation()}>
            {!roomState.isSessionStarted ? (
              <button
                onClick={onStartSession}
                className="w-full md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer hover:shadow-emerald-950/40"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Démarrer la session</span>
              </button>
            ) : !roomState.isRevealed ? (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={onRevealVotes}
                  disabled={votedCount === 0}
                  className={`w-full md:w-auto px-4 py-2 rounded-xl font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    votedCount > 0
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer shadow-indigo-950/50'
                      : 'bg-slate-900/60 text-slate-600 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>
                    Dévoiler ({votedCount}/{totalVotersCount})
                  </span>
                  <kbd className="hidden sm:inline-block px-1.5 bg-black/40 border border-white/20 rounded text-[9px] font-mono text-indigo-200 ml-1">
                    R
                  </kbd>
                </button>
                {onStopSession && (
                  <button
                    onClick={onStopSession}
                    className="px-3 py-2 bg-slate-900/60 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    title="Arrêter la session"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
                    <span>Stopper</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => onResetVotes()}
                  className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shadow-indigo-950/50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Relancer le vote</span>
                  <kbd className="hidden sm:inline-block px-1.5 bg-black/40 border border-white/20 rounded text-[9px] font-mono text-indigo-200 ml-1">
                    S
                  </kbd>
                </button>
                {onStopSession && (
                  <button
                    onClick={onStopSession}
                    className="px-3 py-2 bg-slate-900/60 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 rounded-xl font-semibold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                    title="Arrêter la session"
                  >
                    <Square className="w-3.5 h-3.5 text-rose-400 fill-rose-500/20" />
                    <span>Stopper</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SVG Poker Table Arena (Aérien, Vectoriel, Sobre) */}
      <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] min-h-[380px] sm:min-h-[440px] bg-[#0A0D14] border border-slate-800/80 rounded-3xl p-4 flex items-center justify-center shadow-xl overflow-hidden my-2">
        
        {/* Full Vector SVG Canvas Background & Interactive Table Graphics */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1000 560"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Subtle Minimalist Felt Grid Pattern */}
            <pattern id="tableGridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="0.8" fill="#334155" fillOpacity="0.35" />
            </pattern>

            {/* Radial Felt Gradient (Deep, Sober Slate-Blue) */}
            <radialGradient id="feltGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#141926" stopOpacity="0.95" />
              <stop offset="60%" stopColor="#0E121B" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#080B10" stopOpacity="0.98" />
            </radialGradient>

            {/* Center Hub Glow Gradient */}
            <radialGradient id="hubCenterGlow" cx="50%" cy="50%" r="50%">
              <stop
                offset="0%"
                stopColor={roomState.isRevealed ? '#10B981' : '#6366F1'}
                stopOpacity="0.16"
              />
              <stop
                offset="100%"
                stopColor={roomState.isRevealed ? '#10B981' : '#6366F1'}
                stopOpacity="0"
              />
            </radialGradient>

            {/* Progress Stroke Gradient */}
            <linearGradient id="ringProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="50%" stopColor="#818CF8" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>

            {/* Subtle Ellipse Rim Gradient */}
            <linearGradient id="rimBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#1E293B" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#475569" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Background Grid Pattern Fill */}
          <rect width="1000" height="560" fill="url(#tableGridPattern)" />

          {/* Outer Table Aura Ellipse */}
          <ellipse
            cx="500"
            cy="280"
            rx="450"
            ry="250"
            fill="none"
            stroke="#6366F1"
            strokeOpacity="0.04"
            strokeWidth="1.5"
          />

          {/* Main Outer Table Felt Oval */}
          <ellipse
            cx="500"
            cy="280"
            rx="420"
            ry="230"
            fill="url(#feltGradient)"
            stroke="url(#rimBorderGradient)"
            strokeWidth="2.5"
          />

          {/* Inner Orbital Orbit Track (Fine vector dashes) */}
          <ellipse
            cx="500"
            cy="280"
            rx="360"
            ry="185"
            fill="none"
            stroke="#6366F1"
            strokeOpacity="0.12"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />

          {/* Secondary Inner Ring */}
          <ellipse
            cx="500"
            cy="280"
            rx="270"
            ry="135"
            fill="none"
            stroke="#38BDF8"
            strokeOpacity="0.08"
            strokeWidth="1"
          />

          {/* Vector Ray Lines connecting Table Hub to each Seated Player */}
          {participantNodes.map(({ participant: p, svgX, svgY }) => {
            const hasVoted = p.hasVoted || p.value !== undefined || p.backValue !== undefined;
            const isSpectator = p.isSpectator;

            return (
              <g key={`ray-${p.userId}`}>
                <line
                  x1="500"
                  y1="280"
                  x2={svgX}
                  y2={svgY}
                  stroke={isSpectator ? '#A855F7' : hasVoted ? '#10B981' : '#6366F1'}
                  strokeOpacity={hasVoted ? 0.3 : 0.1}
                  strokeWidth={hasVoted ? 1.5 : 1}
                  strokeDasharray={hasVoted ? 'none' : '3 5'}
                  className="transition-all duration-500"
                />
                {/* Tiny vector node dot at participant anchor */}
                <circle
                  cx={svgX}
                  cy={svgY}
                  r="2.5"
                  fill={isSpectator ? '#A855F7' : hasVoted ? '#10B981' : '#64748B'}
                  fillOpacity={hasVoted ? 0.7 : 0.4}
                />
              </g>
            );
          })}

          {/* Center Hub Glowing Aura */}
          <circle cx="500" cy="280" r="140" fill="url(#hubCenterGlow)" />

          {/* Center Circular Progress SVG Ring (Vote completion indicator) */}
          {totalVotersCount > 0 && roomState.isSessionStarted && (
            <g transform="rotate(-90 500 280)">
              {/* Background Circular Track */}
              <circle
                cx="500"
                cy="280"
                r={ringRadius}
                fill="#0B0E16"
                fillOpacity="0.9"
                stroke="#1E293B"
                strokeWidth="4"
              />
              {/* Active Progress Ring Arc */}
              <circle
                cx="500"
                cy="280"
                r={ringRadius}
                fill="none"
                stroke={roomState.isRevealed ? '#10B981' : 'url(#ringProgressGradient)'}
                strokeWidth="4.5"
                strokeDasharray={ringCircumference}
                strokeDashoffset={roomState.isRevealed ? 0 : ringOffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </g>
          )}

          {/* Concentric Reveal Waves on Vote Unveiling */}
          {roomState.isRevealed && (
            <g>
              <circle
                cx="500"
                cy="280"
                r="95"
                fill="none"
                stroke="#10B981"
                strokeOpacity="0.25"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
              <circle
                cx="500"
                cy="280"
                r="170"
                fill="none"
                stroke="#34D399"
                strokeOpacity="0.12"
                strokeWidth="1"
              />
            </g>
          )}
        </svg>

        {/* Central HUD / Core Information Bubble (Aérien & Minimaliste) */}
        <div className="relative z-10 max-w-xs text-center flex flex-col items-center justify-center p-3 pointer-events-auto">
          {!roomState.isSessionStarted ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm">
                <Play className="w-5 h-5 fill-emerald-400 ml-0.5" />
              </div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Prêt pour l'estimation
              </div>
              {isHost ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onStartSession) onStartSession();
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Play className="w-3 h-3 fill-white" />
                  <span>Lancer la session</span>
                </button>
              ) : (
                <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
                  <span>En attente du lancement...</span>
                </div>
              )}
            </div>
          ) : roomState.isRevealed ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider mt-0.5">
                Votes Dévoilés
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {totalVotersCount} estimation{totalVotersCount > 1 ? 's' : ''} enregistrée{totalVotersCount > 1 ? 's' : ''}
              </span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shadow-sm">
                {votedCount === totalVotersCount && totalVotersCount > 0 ? (
                  <CheckCheck className="w-5 h-5 text-emerald-400" />
                ) : (
                  <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                )}
              </div>
              
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                Tour de Table
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                <span className={`font-mono text-sm ${votedCount === totalVotersCount && totalVotersCount > 0 ? 'text-emerald-400' : 'text-indigo-300'}`}>
                  {votedCount}
                </span>
                <span className="text-slate-500">/</span>
                <span className="font-mono text-xs text-slate-400">{totalVotersCount}</span>
                <span className="text-slate-400 text-[11px]">ont voté</span>
              </div>

              {spectatorsList.length > 0 && (
                <div className="text-[10px] text-indigo-300/80 font-medium flex items-center gap-1 mt-0.5">
                  <Eye className="w-3 h-3 text-indigo-400" />
                  <span>+{spectatorsList.length} spectateur{spectatorsList.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Participant Cards Around the Table */}
        <div className="absolute inset-0 pointer-events-none">
          {participantNodes.map(({ participant: p, leftPct, topPct, isCurrent }) => {
            const hasVoted = p.hasVoted || p.value !== undefined || p.backValue !== undefined;

            return (
              <div
                key={p.userId}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)'
                }}
                className="absolute pointer-events-auto flex flex-col items-center gap-1.5 transition-all duration-500 z-20"
              >
                {/* Participant Card Container */}
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  whileHover={{ y: -3 }}
                  className="relative group participant-card"
                  data-participant-card="true"
                  id={`participant-card-${p.userId}`}
                >
                  <motion.div
                    animate={{ rotateY: roomState.isRevealed ? 360 : 0 }}
                    transition={{ duration: 0.55, type: 'spring', bounce: 0.28 }}
                    className={`relative rounded-2xl border flex flex-col items-center justify-center font-bold shadow-md transition-all ${
                      roomState.estimationMode === 'DUAL' ? 'w-14 h-20 sm:w-16 sm:h-22 p-1' : 'w-12 h-18 sm:w-14 sm:h-20'
                    } ${
                      p.isSpectator
                        ? 'bg-[#151222]/90 border-indigo-500/30 text-indigo-300'
                        : roomState.isRevealed
                        ? 'bg-[#161B26] border-indigo-500/60 text-white shadow-indigo-950/40'
                        : hasVoted
                        ? 'bg-gradient-to-b from-indigo-600 to-indigo-700 border-indigo-400/90 text-white shadow-indigo-950/60'
                        : 'bg-[#10141D]/90 border-slate-800/90 text-slate-600'
                    }`}
                  >
                    {/* Subtle Card Back Geometric SVG Vector Overlay */}
                    {!roomState.isRevealed && !p.isSpectator && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none opacity-20 rounded-2xl overflow-hidden"
                        viewBox="0 0 56 80"
                        preserveAspectRatio="none"
                      >
                        <line x1="0" y1="0" x2="56" y2="80" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
                        <line x1="56" y1="0" x2="0" y2="80" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" />
                        <circle cx="28" cy="40" r="12" fill="none" stroke="currentColor" strokeWidth="0.8" />
                      </svg>
                    )}

                    <AnimatePresence mode="wait">
                      {p.isSpectator ? (
                        <motion.div
                          key="spectator"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex flex-col items-center gap-1 text-indigo-400 p-1 text-center"
                        >
                          <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                          <span className="text-[8px] font-bold uppercase tracking-widest text-indigo-300/90 leading-tight">
                            Observateur
                          </span>
                        </motion.div>
                      ) : roomState.isRevealed ? (
                        roomState.estimationMode === 'DUAL' ? (
                          <motion.div
                            key="revealed-dual"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-1 w-full text-center px-0.5"
                          >
                            <div className="w-full bg-[#0B0E14] border border-slate-800/80 rounded-lg px-1.5 py-0.5 text-[9px] font-mono text-slate-300 flex items-center justify-between">
                              <span className="text-[8px] font-semibold text-slate-400">BK</span>
                              <strong className="font-bold text-white text-xs">{p.backValue !== undefined ? String(p.backValue) : '-'}</strong>
                            </div>
                            <div className="w-full bg-[#0B0E14] border border-slate-800/80 rounded-lg px-1.5 py-0.5 text-[9px] font-mono text-slate-300 flex items-center justify-between">
                              <span className="text-[8px] font-semibold text-slate-400">FR</span>
                              <strong className="font-bold text-white text-xs">{p.frontValue !== undefined ? String(p.frontValue) : '-'}</strong>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="revealed"
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-bold text-lg sm:text-xl text-white tracking-tight"
                          >
                            {p.value !== undefined ? String(p.value) : '-'}
                          </motion.div>
                        )
                      ) : roomState.estimationMode === 'DUAL' ? (
                        <motion.div
                          key="voted-dual"
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center gap-1 w-full px-1 text-center"
                        >
                          <span className={`w-full text-[8px] font-bold px-1.5 py-0.5 rounded-md border flex items-center justify-between ${
                            (p.hasBackVoted || p.backValue !== undefined)
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                              : 'bg-[#0B0E14] border-slate-800 text-slate-500'
                          }`}>
                            <span>BK</span>
                            <span>{(p.hasBackVoted || p.backValue !== undefined) ? '✓' : '?'}</span>
                          </span>
                          <span className={`w-full text-[8px] font-bold px-1.5 py-0.5 rounded-md border flex items-center justify-between ${
                            (p.hasFrontVoted || p.frontValue !== undefined)
                              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                              : 'bg-[#0B0E14] border-slate-800 text-slate-500'
                          }`}>
                            <span>FR</span>
                            <span>{(p.hasFrontVoted || p.frontValue !== undefined) ? '✓' : '?'}</span>
                          </span>
                        </motion.div>
                      ) : hasVoted ? (
                        <motion.div
                          key="voted"
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center gap-1 text-center"
                        >
                          <CheckCircle2 className="w-5 h-5 text-white" />
                          <span className="text-[8px] font-bold text-indigo-100 uppercase tracking-wider">Voté</span>
                        </motion.div>
                      ) : (
                        <motion.div key="pending" className="text-xs font-semibold text-slate-500">
                          ?
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>

                  {/* Avatar & Badges */}
                  <div className="absolute -bottom-2 -right-2 flex items-center">
                    <AvatarDisplay
                      user={p}
                      className={`w-6 h-6 sm:w-7 sm:h-7 text-[10px] border-2 shadow-sm ${
                        p.isSpectator
                          ? 'border-indigo-500/50 ring-2 ring-indigo-500/20'
                          : hasVoted
                          ? 'border-indigo-400 ring-2 ring-indigo-500/30'
                          : 'border-slate-800'
                      }`}
                    />
                    {p.isHost && (
                      <span className="absolute -top-2.5 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full shadow" title="Créateur">
                        <Crown className="w-2.5 h-2.5 fill-slate-950" />
                      </span>
                    )}
                  </div>
                </motion.div>

                {/* Participant Name Pill */}
                <div className="flex flex-col items-center text-center">
                  <div className={`flex items-center gap-1 border px-2.5 py-0.5 rounded-full shadow-sm max-w-[100px] sm:max-w-[120px] transition-colors ${
                    p.isOffline
                      ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                      : p.isSpectator
                      ? 'bg-[#151222] border-indigo-500/30 text-indigo-200'
                      : 'bg-[#10141D]/90 border-slate-800/90 text-slate-200'
                  }`}>
                    <span className="text-[11px] font-medium truncate">
                      {p.userName}
                    </span>
                    {p.isSpectator && (
                      <Eye className="w-3 h-3 text-indigo-400 shrink-0" title="Spectateur" />
                    )}
                    {p.isGoogleAuth && (
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" title="Authentifié Google" />
                    )}
                    {p.isOffline && (
                      <WifiOff className="w-3 h-3 text-amber-500/80 shrink-0" title="Hors ligne" />
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-[9px] font-semibold tracking-wider uppercase mt-0.5 text-indigo-400">
                      (Vous{p.isSpectator ? ' - Spectateur' : ''})
                    </span>
                  )}

                  {/* Host Controls */}
                  {isHost && !isCurrent && (
                    <div className="flex items-center gap-1 mt-0.5">
                      {!p.isSpectator && !p.hasVoted && !roomState.isRevealed && onNudgeUser && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNudgeUser(p.userId);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Relancer"
                        >
                          <Bell className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-semibold uppercase tracking-wider">Nudge</span>
                        </button>
                      )}

                      {onKickUser && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onKickUser(p.userId);
                          }}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Exclure"
                        >
                          <UserX className="w-2.5 h-2.5" />
                          <span className="text-[8px] font-semibold uppercase tracking-wider">Exclure</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

