import React, { useState } from 'react';
import { LogIn, ArrowRight, X, Hash } from 'lucide-react';

interface JoinByCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCode: (code: string) => void;
}

export const JoinByCodeModal: React.FC<JoinByCodeModalProps> = ({
  isOpen,
  onClose,
  onSubmitCode,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let raw = code.trim();
    if (!raw) {
      setError('Veuillez saisir un code de salle valide.');
      return;
    }

    // Support pasted URL
    if (raw.includes('room=')) {
      try {
        const urlParams = new URLSearchParams(raw.split('?')[1] || '');
        const extracted = urlParams.get('room');
        if (extracted) raw = extracted;
      } catch (err) {
        // Fallback
      }
    }

    // Normalize code
    let formattedCode = raw.toLowerCase();
    if (!formattedCode.startsWith('scrum-') && !formattedCode.includes('-')) {
      formattedCode = `scrum-${formattedCode}`;
    }

    onSubmitCode(formattedCode);
    setCode('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#14171D] border border-[#242933] text-[#E2E8F0] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-[#1A1D23] hover:bg-[#242933] rounded-full transition-colors"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 mb-3">
            <Hash className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Rejoindre une Salle</h2>
          <p className="text-xs text-slate-400 mt-1">
            Saisissez le code de la salle ou collez le lien complet d'invitation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Code de la Salle
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="ex: scrum-lvunf ou lvunf"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full bg-[#0B0D10] border border-[#242933] focus:border-blue-500 rounded-xl px-4 py-3.5 text-sm font-mono text-white placeholder-slate-500 outline-none transition-all"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs font-semibold text-rose-400 mt-2">
                ⚠️ {error}
              </p>
            )}
            <p className="text-[11px] text-slate-500 mt-2">
              Exemple de format : <code className="text-blue-400 font-mono">scrum-lvunf</code> ou juste <code className="text-blue-400 font-mono">lvunf</code>
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 group cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Rejoindre la Salle
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
};
