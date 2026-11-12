import React, { useState, useEffect } from 'react';
import { User, DeckType, VoteValue, CreatedRoomSummary } from '../types';
import { DECK_PRESETS } from '../constants/avatars';
import {
  PlusCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Lock,
  Users,
  LogIn,
  Hash,
  FolderClock,
  Layers,
  BarChart3,
  ListTodo,
  Smile,
  Zap,
  CheckCircle2,
  Clock,
  Eye,
  Sliders,
  Share2,
  Coffee,
  HelpCircle,
  ChevronRight,
  Flame,
  Radio
} from 'lucide-react';

interface HomePageProps {
  currentUser: User | null;
  onCreateRoom: () => void;
  onJoinByCode: (code: string) => void;
  onOpenGoogleAuth: () => void;
  onOpenCreatedRooms: () => void;
  onOpenCustomizer?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  onCreateRoom,
  onJoinByCode,
  onOpenGoogleAuth,
  onOpenCreatedRooms,
  onOpenCustomizer
}) => {
  const [codeInputValue, setCodeInputValue] = useState('');
  const [previewDeckType, setPreviewDeckType] = useState<DeckType>('fibonacci');
  const [previewEstimationMode, setPreviewEstimationMode] = useState<'GLOBAL' | 'DUAL'>('GLOBAL');
  const [previewIsRevealed, setPreviewIsRevealed] = useState(false);
  const [previewUserVote, setPreviewUserVote] = useState<VoteValue | null>(5);
  const [previewBackVote, setPreviewBackVote] = useState<VoteValue | null>(3);
  const [previewFrontVote, setPreviewFrontVote] = useState<VoteValue | null>(5);
  const [recentRooms, setRecentRooms] = useState<CreatedRoomSummary[]>([]);

  // Load recent rooms for quick resume
  useEffect(() => {
    try {
      const userKey = currentUser?.id ? `scrum_poker_created_rooms_${currentUser.id}` : 'scrum_poker_created_rooms_guest';
      const raw = localStorage.getItem(userKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentRooms(parsed.slice(0, 3));
        }
      }
    } catch {
      // ignore
    }
  }, [currentUser]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInputValue.trim()) {
      onJoinByCode(codeInputValue.trim());
    }
  };

  const currentDeck = DECK_PRESETS[previewDeckType] || DECK_PRESETS.fibonacci;

  return (
    <div id="home-page-container" className="flex-1 w-full flex flex-col items-center justify-start pb-20 overflow-x-hidden">
      {/* Background Ambient SVG Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg className="w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="airy-grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#334155" strokeWidth="0.5" strokeDasharray="2 4" />
            </pattern>
            <radialGradient id="hero-glow" cx="50%" cy="20%" r="60%">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.18" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0B0D10" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#airy-grid)" />
          <rect width="100%" height="100%" fill="url(#hero-glow)" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-10 flex flex-col items-center">
        
        {/* Top Status & Pill Badge */}
        <div id="home-pill-badge" className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/60 shadow-lg backdrop-blur-md mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-slate-300 tracking-wide">Scrum Poker Express • Chiffrage Agile Collaboratif</span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center max-w-3xl mb-8">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Estimez vos stories en{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300">
              temps réel
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300/90 max-w-2xl mx-auto leading-relaxed font-normal">
            Une interface sobre, aérienne et fluide pour synchroniser votre équipe agile. Cartes secrètes, chiffrage global ou dual Front/Back, backlog intégré et statistiques de consensus instantanées.
          </p>
        </div>

        {/* Action Center (Primary CTAs & Fast Join) */}
        <div id="home-action-center" className="w-full max-w-2xl bg-slate-900/70 border border-slate-800/80 rounded-3xl p-5 sm:p-7 shadow-2xl backdrop-blur-xl mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Create Room Button */}
            <button
              id="home-create-room-btn"
              onClick={onCreateRoom}
              className="py-4 px-6 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/35 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer group"
            >
              <div className="p-1.5 bg-white/10 rounded-xl">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-extrabold">Créer une Salle</div>
                <div className="text-[11px] text-indigo-100/80 font-normal">Instantané & privé</div>
              </div>
              <ArrowRight className="w-4 h-4 ml-auto group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Google Auth / Profile Button */}
            <button
              id="home-google-auth-btn"
              onClick={onOpenGoogleAuth}
              className="py-4 px-6 bg-[#141720] hover:bg-[#1A1F2B] text-slate-200 font-semibold rounded-2xl border border-slate-800/90 hover:border-indigo-500/40 transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="p-2 bg-slate-800 rounded-xl text-emerald-400 group-hover:text-emerald-300 transition-colors">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">
                    {currentUser?.isGoogleAuth ? 'Compte Google Connecté' : currentUser ? currentUser.name : 'Connexion Google'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {currentUser?.email || 'Sauvegarde automatique Cloud'}
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
            </button>
          </div>

          {/* Quick Room Code Input Form */}
          <div className="pt-5 border-t border-slate-800/70">
            <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-2.5 items-stretch">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Hash className="w-4 h-4 text-indigo-400" />
                </div>
                <input
                  id="home-join-code-input"
                  type="text"
                  placeholder="Entrez un code de salle (ex: scrum-k49z ou k49z)"
                  value={codeInputValue}
                  onChange={(e) => setCodeInputValue(e.target.value)}
                  className="w-full bg-[#0E1217] border border-slate-800 focus:border-indigo-500/70 focus:ring-2 focus:ring-indigo-500/20 rounded-2xl pl-10 pr-4 py-3.5 text-sm font-mono text-white placeholder-slate-500 outline-none transition-all"
                />
              </div>
              <button
                id="home-join-submit-btn"
                type="submit"
                disabled={!codeInputValue.trim()}
                className="px-6 py-3.5 bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-slate-800 text-white font-bold text-sm rounded-2xl transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-md"
              >
                <LogIn className="w-4 h-4" />
                Rejoindre la Salle
              </button>
            </form>
          </div>

          {/* Recent Rooms Quick Access Pill Strip */}
          {recentRooms.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-800/50 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5 mr-1">
                <FolderClock className="w-3.5 h-3.5 text-indigo-400" />
                Vos salles récentes :
              </span>
              {recentRooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => onJoinByCode(room.roomId)}
                  className="px-3 py-1.5 bg-[#0E1217] hover:bg-indigo-950/50 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-slate-300 hover:text-white font-mono transition-all flex items-center gap-1.5 cursor-pointer"
                  title={`Créée par ${room.hostName}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="max-w-[120px] truncate">{room.roomName || room.roomId}</span>
                </button>
              ))}
              <button
                onClick={onOpenCreatedRooms}
                className="text-indigo-400 hover:text-indigo-300 font-semibold ml-auto transition-colors cursor-pointer"
              >
                Voir tout →
              </button>
            </div>
          )}
        </div>

        {/* INTERACTIVE LIVE TABLE SIMULATION (Clean SVG + Live Interactive Controls) */}
        <section id="home-live-preview-section" className="w-full max-w-4xl mb-16">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Aperçu Interactif de la Table de Poker
                </h2>
              </div>
              <p className="text-xs text-slate-400">
                Explorez le fonctionnement en direct : changez le mode, votez et révélez le consensus.
              </p>
            </div>

            {/* Interactive Preview Controls Bar */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 p-1 rounded-2xl">
              <button
                onClick={() => setPreviewEstimationMode(m => m === 'GLOBAL' ? 'DUAL' : 'GLOBAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewEstimationMode === 'DUAL'
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                {previewEstimationMode === 'DUAL' ? 'Mode Dual (Front & Back)' : 'Mode Global (Unique)'}
              </button>

              <button
                onClick={() => setPreviewIsRevealed(r => !r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  previewIsRevealed
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {previewIsRevealed ? 'Masquer' : 'Révéler les cartes'}
              </button>
            </div>
          </div>

          {/* SOBER & AIRY POKER TABLE SVG CANVAS */}
          <div className="relative w-full bg-[#0E1218]/90 border border-slate-800/80 rounded-3xl p-6 sm:p-10 shadow-2xl overflow-hidden backdrop-blur-md">
            
            {/* SVG Background Table Graphic */}
            <div className="relative w-full min-h-[320px] sm:min-h-[360px] flex items-center justify-center">
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 800 380" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="table-rim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#312E81" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#1E293B" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#0F172A" stopOpacity="0.8" />
                  </linearGradient>
                  <radialGradient id="table-felt" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.35" />
                    <stop offset="70%" stopColor="#0F172A" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#090D14" stopOpacity="0.9" />
                  </radialGradient>
                  <filter id="table-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Table Outer Shadow & Rail */}
                <rect x="70" y="45" width="660" height="290" rx="145" fill="url(#table-rim-grad)" stroke="#334155" strokeWidth="1.5" />
                {/* Table Inner Felt */}
                <rect x="85" y="60" width="630" height="260" rx="130" fill="url(#table-felt)" stroke="#4F46E5" strokeWidth="1" strokeOpacity="0.25" />
                {/* Center Ring Accent */}
                <ellipse cx="400" cy="190" rx="140" ry="60" stroke="#6366F1" strokeWidth="1" strokeDasharray="4 6" strokeOpacity="0.3" />
              </svg>

              {/* Center Table Info (Active Story & Timer) */}
              <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-xs sm:max-w-sm px-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-[11px] text-indigo-300 font-semibold mb-2">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Story active #US-104
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white mb-2 line-clamp-2">
                  Optimisation du tunnel de commande & paiement
                </h4>

                {previewIsRevealed ? (
                  <div className="flex items-center gap-3 bg-slate-900/90 border border-emerald-500/30 px-3.5 py-1.5 rounded-2xl text-xs text-emerald-400 font-bold shadow-lg animate-in fade-in zoom-in-95 duration-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Consensus : <strong>5 points</strong> (Moyenne 5.0)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-700/60 px-3 py-1 rounded-2xl text-xs text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span>3 / 4 votes enregistrés</span>
                  </div>
                )}
              </div>

              {/* PARTICIPANT PODS (Around the SVG Table) */}
              {/* Seat 1: Top Left - Sophie (Dev Front) */}
              <div className="absolute top-2 left-6 sm:left-14 flex flex-col items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 border-2 border-slate-700 flex items-center justify-center font-bold text-white text-xs shadow-md">
                    SO
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0E1218] rounded-full"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-300 mt-1">Sophie</span>
                {/* Card */}
                <div className="mt-1.5">
                  {previewIsRevealed ? (
                    <div className="px-2.5 py-1 bg-slate-800 border border-indigo-400 text-indigo-300 rounded-lg text-xs font-bold shadow-md animate-in flip-in-y duration-300">
                      {previewEstimationMode === 'DUAL' ? 'F: 5 / B: 3' : '5'}
                    </div>
                  ) : (
                    <div className="w-6 h-8 bg-indigo-600/90 border border-indigo-400/80 rounded-md flex items-center justify-center shadow-lg">
                      <Lock className="w-3 h-3 text-white/90" />
                    </div>
                  )}
                </div>
              </div>

              {/* Seat 2: Top Right - Alex (Lead Dev) */}
              <div className="absolute top-2 right-6 sm:right-14 flex flex-col items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 border-2 border-slate-700 flex items-center justify-center font-bold text-white text-xs shadow-md">
                    AL
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0E1218] rounded-full"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-300 mt-1">Alex</span>
                <div className="mt-1.5">
                  {previewIsRevealed ? (
                    <div className="px-2.5 py-1 bg-slate-800 border border-indigo-400 text-indigo-300 rounded-lg text-xs font-bold shadow-md animate-in flip-in-y duration-300">
                      {previewEstimationMode === 'DUAL' ? 'F: 5 / B: 5' : '5'}
                    </div>
                  ) : (
                    <div className="w-6 h-8 bg-indigo-600/90 border border-indigo-400/80 rounded-md flex items-center justify-center shadow-lg">
                      <Lock className="w-3 h-3 text-white/90" />
                    </div>
                  )}
                </div>
              </div>

              {/* Seat 3: Bottom Left - Maya (Dev Back) */}
              <div className="absolute bottom-2 left-6 sm:left-14 flex flex-col items-center">
                <div className="mt-1.5 mb-1">
                  {previewIsRevealed ? (
                    <div className="px-2.5 py-1 bg-slate-800 border border-indigo-400 text-indigo-300 rounded-lg text-xs font-bold shadow-md animate-in flip-in-y duration-300">
                      {previewEstimationMode === 'DUAL' ? 'F: 3 / B: 5' : '5'}
                    </div>
                  ) : (
                    <div className="w-6 h-8 bg-indigo-600/90 border border-indigo-400/80 rounded-md flex items-center justify-center shadow-lg">
                      <Lock className="w-3 h-3 text-white/90" />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-500 border-2 border-slate-700 flex items-center justify-center font-bold text-white text-xs shadow-md">
                    MY
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0E1218] rounded-full"></span>
                </div>
                <span className="text-[11px] font-medium text-slate-300 mt-1">Maya</span>
              </div>

              {/* Seat 4: Bottom Right - Vous (Interactive Player) */}
              <div className="absolute bottom-2 right-6 sm:right-14 flex flex-col items-center">
                <div className="mt-1.5 mb-1">
                  {previewIsRevealed ? (
                    <div className="px-2.5 py-1 bg-slate-800 border border-emerald-400 text-emerald-300 rounded-lg text-xs font-bold shadow-md animate-in flip-in-y duration-300">
                      {previewEstimationMode === 'DUAL' ? `F: ${previewFrontVote || '-'} / B: ${previewBackVote || '-'}` : (previewUserVote || '-')}
                    </div>
                  ) : (
                    <div className="w-6 h-8 bg-emerald-600/90 border border-emerald-400/80 rounded-md flex items-center justify-center shadow-lg">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-emerald-500 border-2 border-emerald-400 flex items-center justify-center font-bold text-white text-xs shadow-md ring-2 ring-emerald-400/30">
                    VOUS
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-400 mt-1">Votre vote</span>
              </div>
            </div>

            {/* INTERACTIVE MINI DECK BAR (Try picking a card directly) */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {previewEstimationMode === 'DUAL' ? 'Choisissez vos cartes (Dual Front & Back)' : 'Sélectionnez votre carte d\'estimation :'}
                  </span>
                </div>

                {/* Deck presets tab picker */}
                <div className="flex items-center gap-1 bg-[#141720] border border-slate-800 p-1 rounded-xl">
                  {(['fibonacci', 'tshirt', 'powers_of_2', 'hours'] as DeckType[]).map((dType) => (
                    <button
                      key={dType}
                      onClick={() => setPreviewDeckType(dType)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                        previewDeckType === dType
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {dType === 'fibonacci' ? 'Fibonacci' : dType === 'tshirt' ? 'T-Shirt' : dType === 'powers_of_2' ? 'Puiss. 2' : 'Heures'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards List Display */}
              <div className="flex items-center justify-center sm:justify-start gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {currentDeck.values.slice(0, 8).map((val) => {
                  const isSelected = previewEstimationMode === 'GLOBAL' && previewUserVote === val;
                  return (
                    <button
                      key={String(val)}
                      onClick={() => {
                        setPreviewUserVote(val);
                      }}
                      className={`h-14 w-10 sm:w-12 rounded-xl flex flex-col items-center justify-between p-1.5 transition-all cursor-pointer shadow-md transform hover:-translate-y-1 ${
                        isSelected
                          ? 'bg-gradient-to-b from-indigo-500 to-indigo-700 border-2 border-indigo-300 text-white scale-105 shadow-indigo-600/40'
                          : 'bg-[#151922] hover:bg-[#1C2230] border border-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="text-[10px] opacity-70 font-mono">{val}</span>
                      <span className="text-sm font-extrabold">{val}</span>
                      <span className="text-[10px] opacity-70 font-mono">{val}</span>
                    </button>
                  );
                })}
                <div className="text-xs text-slate-500 italic ml-2 hidden sm:block">
                  (Cliquez pour tester)
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* THREE SIMPLE STEPS (AGILE FLOW SVG DIAGRAM) */}
        <section className="w-full max-w-4xl mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Comment ça marche ?
            </h2>
            <p className="text-sm text-slate-400 max-w-lg mx-auto">
              3 étapes simples pour estimer avec clarté, éliminer les biais d'ancrage et accélérer vos rituels Scrum.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 relative flex flex-col items-start hover:border-slate-700/80 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm mb-4">
                01
              </div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-indigo-400" />
                Créez & Partagez
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Créez une salle en 1 clic via votre compte Google, puis partagez le lien ou le code court : vos invités rejoignent instantanément sans aucune inscription.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 relative flex flex-col items-start hover:border-slate-700/80 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-sm mb-4">
                02
              </div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                Estimez en Secret
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chaque participant choisit sa carte en toute indépendance (mode global ou dual Front/Back). Aucune influence avant la révélation.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 relative flex flex-col items-start hover:border-slate-700/80 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm mb-4">
                03
              </div>
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Révélez & Arbitrez
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Révélez les estimations d'un coup. Analysez la moyenne, le mode, résolvez les écarts et enregistrez le score dans le backlog.
              </p>
            </div>
          </div>
        </section>

        {/* CORE FEATURES GRID (SOBRE, AIRY, ACCURATE PRESENTATION) */}
        <section className="w-full max-w-5xl mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Conçu pour les équipes agiles modernes
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Chaque fonctionnalité a été pensée pour rendre vos sessions de sprint planning précises, agréables et sans friction.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature 1: Mode Dual Front/Back */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Chiffrage Dual Front & Back</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Permet d'estimer séparément la complexité Front-End et Back-End sur la même story pour une vélocité technique ultra-fine.
              </p>
            </div>

            {/* Feature 2: Multi-Decks & Custom */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Sliders className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Multi-Decks & Sur-Mesure</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fibonacci standard (0.25 à 100), T-Shirt (XS à XXL), puissances de 2, heures/jours, ou configurez vos propres valeurs de cartes.
              </p>
            </div>

            {/* Feature 3: Backlog & Stories */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ListTodo className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Backlog & Suivi des Stories</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Importez ou créez vos User Stories, chargez-les directement sur la table de poker et conservez les scores validés.
              </p>
            </div>

            {/* Feature 4: Analytics & Consensus */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Statistiques & Arbitrage</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Calcul automatique de la moyenne, du mode, répartition graphique des votes et arbitrage du score final en un clic.
              </p>
            </div>

            {/* Feature 5: Émojis & Dynamisme */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Smile className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Réactions Émojis & Audio</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Envoyez des réactions émojis en direct qui traversent la table, activez les effets sonores de cartes et célébrez les consensus.
              </p>
            </div>

            {/* Feature 6: Cloud Firestore & Synchronisation */}
            <div className="bg-[#0E1217] border border-slate-800/80 hover:border-indigo-500/30 rounded-3xl p-6 transition-all group">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Synchronisation & Cloud</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Communication WebSockets ultra-rapide et persistance Cloud Firestore pour retrouver vos salles, historiques et statistiques.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section className="w-full max-w-4xl bg-gradient-to-b from-indigo-950/40 to-slate-900/60 border border-indigo-500/20 rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden backdrop-blur-md">
          <div className="absolute inset-0 bg-radial from-indigo-500/10 via-transparent to-transparent pointer-events-none"></div>
          
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            Prêt pour votre prochain rituel d'estimation ?
          </h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
            Lancez une session en quelques secondes et invitez votre équipe sans aucune friction technique.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onCreateRoom}
              className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" />
              Créer une Salle Immédiatement
            </button>

            <button
              onClick={onOpenGoogleAuth}
              className="w-full sm:w-auto px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {currentUser?.isGoogleAuth ? 'Gérer mon compte' : 'Se connecter avec Google'}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};
