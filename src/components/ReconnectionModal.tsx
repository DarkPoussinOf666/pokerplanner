import React, { useState } from 'react';
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { getSocket } from '../lib/socket';

interface ReconnectionModalProps {
  isOpen: boolean;
}

export const ReconnectionModal: React.FC<ReconnectionModalProps> = ({ isOpen }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // 1. Clear session storage while preserving any pending local vote cache
      const pendingVote = sessionStorage.getItem('scrum_poker_current_vote_cache');
      sessionStorage.clear();
      if (pendingVote) {
        sessionStorage.setItem('scrum_poker_current_vote_cache', pendingVote);
      }

      // 2. Clear browser caches if available
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key)));
      }

      // 3. Disconnect socket cleanly
      const socket = getSocket();
      if (socket) {
        socket.disconnect();
      }
    } catch (e) {
      console.error('Error clearing cache during reconnect refresh:', e);
    } finally {
      // 4. Force clean page reload
      window.location.reload();
    }
  };

  return (
    <div 
      role="alertdialog"
      aria-modal="true"
      aria-label="Connexion Interrompue"
      className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-pointer"
      onClick={handleRefresh}
    >
      <div 
        className="max-w-md w-full bg-[#14171D] border-2 border-red-500/50 rounded-3xl p-6 sm:p-8 text-center shadow-2xl shadow-red-950/60 relative overflow-hidden group cursor-pointer transition-all hover:border-red-500 hover:scale-[1.01]"
        onClick={(e) => {
          e.stopPropagation();
          handleRefresh();
        }}
      >
        {/* Ambient background glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Pulsing warning icon */}
        <div className="w-20 h-20 bg-red-500/10 border-2 border-red-500/40 rounded-2xl flex items-center justify-center mx-auto mb-5 text-red-400 relative">
          <span className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping opacity-75" />
          <WifiOff className="w-10 h-10 relative z-10" />
        </div>

        {/* Title */}
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight flex items-center justify-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          Connexion Interrompue
        </h3>

        {/* Message */}
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          La connexion avec le serveur a été interrompue. Cliquez ci-dessous pour vider le cache et rafraîchir proprement votre session.
        </p>

        {/* Action button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="w-full py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-3 text-base cursor-pointer hover:shadow-red-500/50 active:scale-[0.98]"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Reconnexion en cours...' : 'Reconnexion & Rafraîchir'}
        </button>

        <p className="text-[11px] text-slate-500 mt-4">
          Cliquez sur la popup pour vider le cache et rafraîchir
        </p>
      </div>
    </div>
  );
};
