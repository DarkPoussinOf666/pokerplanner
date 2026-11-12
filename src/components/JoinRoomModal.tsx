import React, { useState } from 'react';
import { User } from '../types';
import { UserCheck, Sparkles, ArrowRight, ShieldCheck, Eye, Dices } from 'lucide-react';
import { generateRandomAvatar } from '../constants/avatars';
import { AvatarDisplay } from './AvatarDisplay';

interface JoinRoomModalProps {
  isOpen: boolean;
  roomId: string;
  roomHostName?: string;
  onJoin: (user: User) => void;
  onOpenGoogleAuth: () => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  roomId,
  roomHostName,
  onJoin,
  onOpenGoogleAuth
}) => {
  const [pseudonym, setPseudonym] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(() => generateRandomAvatar());
  const [isSpectator, setIsSpectator] = useState(false);

  if (!isOpen) return null;

  const handleRandomizeAvatar = () => {
    setSelectedAvatar(generateRandomAvatar());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = pseudonym.trim() || selectedAvatar.name;
    const user: User = {
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      avatarSeed: selectedAvatar.avatarSeed,
      avatarUrl: selectedAvatar.avatarSeed,
      isGoogleAuth: false,
      isSpectator
    };
    onJoin(user);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rejoindre la Session"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="bg-[#14171D] border border-[#242933] text-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative my-8 overflow-hidden">
        {/* Subtle glow backdrop */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-5">
          <div className="inline-flex p-3 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl text-fuchsia-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Rejoindre la Session</h2>
          <p className="text-xs text-slate-400 mt-1">
            Salle <span className="font-mono text-fuchsia-400 bg-[#0B0D10] px-2 py-0.5 rounded border border-[#242933]">{roomId}</span>
            {roomHostName && <span> • Créée par {roomHostName}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Pseudonym Input & Avatar Randomizer */}
          <div className="bg-[#0B0D10] border border-[#242933] rounded-2xl p-4 flex gap-4 relative overflow-hidden group">
            
            {/* Avatar */}
            <div className="shrink-0 flex flex-col items-center gap-2">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-lg shadow-fuchsia-950/40 relative">
                <AvatarDisplay
                  user={{
                    name: pseudonym.trim() || selectedAvatar.name,
                    avatarSeed: selectedAvatar.avatarSeed
                  }}
                  size={64}
                />
              </div>
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                className="p-1.5 bg-[#1A1D23] hover:bg-fuchsia-600 hover:text-white text-slate-300 rounded-lg border border-[#242933] transition-all cursor-pointer shadow-sm w-full flex justify-center items-center"
                title="Changer d'avatar"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>

            {/* Input */}
            <div className="flex-1">
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                Votre Nom
              </label>
              <input
                type="text"
                required
                placeholder={`ex: ${selectedAvatar.name}`}
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                className="w-full bg-[#14171D] border border-[#242933] focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
                maxLength={24}
              />
            </div>
          </div>

          {/* Mode Spectateur Toggle */}
          <div
            onClick={() => setIsSpectator(!isSpectator)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
              isSpectator
                ? 'bg-purple-500/10 border-purple-500/40 shadow-md shadow-purple-950/20'
                : 'bg-[#0B0D10] border-[#242933] hover:border-slate-700'
            }`}
          >
            <input
              type="checkbox"
              id="spectatorCheckbox"
              checked={isSpectator}
              onChange={(e) => setIsSpectator(e.target.checked)}
              className="mt-0.5 rounded border-slate-700 text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="spectatorCheckbox" className="cursor-pointer text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                Rejoindre en mode Spectateur
              </span>
              <p className="text-slate-400 text-[11px] mt-0.5 leading-normal">
                Idéal pour les Product Owners : observez sans participer aux votes.
              </p>
            </label>
          </div>

          <button
            type="submit"
            className={`w-full py-3.5 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 group cursor-pointer ${
              isSpectator
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/30'
                : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-fuchsia-900/30'
            }`}
          >
            {isSpectator ? <Eye className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            {isSpectator ? 'Entrer en Spectateur' : 'Entrer dans la Session'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-[#242933] text-center">
          <p className="text-xs text-slate-400 mb-2">Vous êtes créateur de cette salle ?</p>
          <button
            type="button"
            onClick={onOpenGoogleAuth}
            className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Se connecter (Admin)
          </button>
        </div>
      </div>
    </div>
  );
};

