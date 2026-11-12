import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, CheckCircle2, ShieldCheck, X, Sparkles, ExternalLink } from 'lucide-react';
import { googleSignIn } from '../lib/firebase';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  onGoogleSignIn: (googleUser: User) => void;
  onSignOut?: () => void;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onGoogleSignIn,
  onSignOut
}) => {
  const [isLoadingOAuth, setIsLoadingOAuth] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRealGoogleOAuth = async () => {
    setIsLoadingOAuth(true);
    setOauthError(null);

    try {
      const user = await googleSignIn();
      if (user) {
        onGoogleSignIn(user);
        onClose();
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setOauthError("La connexion a été annulée.");
      } else if (err.code === 'auth/popup-blocked') {
        setOauthError("Le navigateur a bloqué la fenêtre popup Google. Veuillez autoriser les popups dans votre navigateur.");
      } else {
        setOauthError("Une erreur s'est produite lors de la connexion.");
      }
    } finally {
      setIsLoadingOAuth(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#14171D] border border-[#242933] text-[#E2E8F0] rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold tracking-tight text-white">Authentification Google</h3>
            <p className="text-xs text-slate-400">Requis pour créer et administrer des salles de Scrum Poker</p>
          </div>
        </div>

        {currentUser?.isGoogleAuth ? (
          <div className="space-y-6">
            <div className="bg-[#1A1D23] border border-emerald-500/30 rounded-xl p-4 flex items-center gap-4">
              <img
                src={currentUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.name)}`}
                alt={currentUser.name}
                className="w-12 h-12 rounded-full border-2 border-emerald-500/50 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Compte Google Vérifié
                </div>
                <h4 className="font-semibold text-slate-100 text-sm truncate">{currentUser.name}</h4>
                <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 bg-[#0B0D10] p-3 rounded-lg border border-[#242933]">
              <p className="flex items-center gap-1.5 font-bold text-slate-300 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Privilèges Administrateur
              </p>
              Vous pouvez créer de nouvelles salles de Scrum Poker, gérer les User Stories, révéler les cartes et réinitialiser le vote.
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg shadow-blue-900/30"
              >
                Continuer vers la salle
              </button>
              {onSignOut && (
                <button
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="py-2.5 px-4 bg-[#1A1D23] hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 font-semibold rounded-lg text-sm transition-colors border border-[#242933]"
                >
                  Déconnexion
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {oauthError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg text-xs">
                {oauthError}
              </div>
            )}

            {/* Strict Google OAuth Button */}
            <button
              onClick={handleRealGoogleOAuth}
              disabled={isLoadingOAuth}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-lg text-sm transition-all shadow-lg shadow-blue-900/30 flex items-center justify-center gap-3 border border-blue-400/20 group relative overflow-hidden"
            >
              <svg className="w-5 h-5 bg-white p-0.5 rounded-full shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoadingOAuth ? 'Ouverture de Google...' : 'Se connecter avec Google'}</span>
              <ExternalLink className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <p className="text-[11px] text-center text-slate-500 leading-relaxed">
              La connexion Google est obligatoire pour créer une salle ou devenir hôte. Les participants rejoignent simplement la salle via son lien en saisissant un pseudonyme.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

