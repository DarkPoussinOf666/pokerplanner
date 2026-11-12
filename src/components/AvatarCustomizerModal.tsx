import React, { useState } from 'react';
import { User } from '../types';
import { Palette, X, Check, Dices, Sparkles } from 'lucide-react';
import { AVATAR_PALETTES, generateRandomAvatar } from '../constants/avatars';
import { AvatarDisplay } from './AvatarDisplay';

interface AvatarCustomizerModalProps {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onSave: (updates: Partial<User>) => void;
}

export const AvatarCustomizerModal: React.FC<AvatarCustomizerModalProps> = ({ 
  isOpen, 
  user, 
  onClose, 
  onSave 
}) => {
  const [name, setName] = useState<string>(user.name);
  const [avatarSeed, setAvatarSeed] = useState<string>(
    user.avatarSeed || user.avatarUrl || generateRandomAvatar(user.name).avatarSeed
  );

  if (!isOpen) return null;

  const handleRandomize = () => {
    const fresh = generateRandomAvatar(name || 'Joueur');
    setAvatarSeed(fresh.avatarSeed);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      avatarSeed,
      avatarUrl: avatarSeed,
    });
    onClose();
  };

  return (
    <div 
      role="dialog"
      aria-modal="true"
      aria-label="Personnaliser Profil"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#12161F] border border-slate-800 text-slate-100 rounded-2xl p-6 sm:p-7 max-w-sm w-full shadow-2xl relative my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-2 hover:bg-slate-800/60 rounded-xl"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Personnaliser Profil</h2>
            <p className="text-xs text-slate-400">Avatar vectoriel SVG & pseudonyme</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Avatar preview with native SVG generator */}
          <div className="flex flex-col items-center justify-center gap-3 py-3 bg-slate-900/50 rounded-xl border border-slate-800/80">
            <AvatarDisplay 
              user={{ name: name || 'Joueur', avatarSeed }} 
              size={76} 
              className="ring-2 ring-indigo-500/30"
            />
            
            <button
              type="button"
              onClick={handleRandomize}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 rounded-lg border border-slate-700/60 transition-all flex items-center gap-2 text-xs font-semibold cursor-pointer shadow-sm"
            >
              <Dices className="w-3.5 h-3.5" />
              Générer un nouvel avatar
            </button>
          </div>

          {/* Color Palettes preview buttons */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Thème graphique
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_PALETTES.map((pal, idx) => (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => setAvatarSeed(`${name}-${pal.id}-${idx * 13}`)}
                  className="h-8 rounded-lg border border-slate-700/60 hover:scale-105 transition-transform flex items-center justify-center relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${pal.from}, ${pal.to})` }}
                  title={pal.name}
                >
                  <span className="text-[9px] font-bold text-white drop-shadow-sm uppercase">
                    {pal.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Pseudonym Field */}
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
              Pseudonyme
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre pseudonyme..."
              className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 text-sm font-medium"
              maxLength={24}
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-indigo-950/40 flex items-center justify-center gap-2 cursor-pointer mt-1"
          >
            <Check className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};
