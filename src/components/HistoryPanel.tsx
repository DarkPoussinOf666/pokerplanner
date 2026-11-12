import React, { useState } from 'react';
import { HistoryItem, VoteValue, DeckType, ArbitrateHandler } from '../types';
import {
  X,
  History,
  Trash2,
  Search,
  Users,
  Award,
  Calculator,
  FileSpreadsheet,
  Clock,
  FolderClock,
  BarChart3,
  Crown,
  Gavel,
  CheckSquare,
  Square
} from 'lucide-react';
import { getActiveDeckValues } from '../lib/stats';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  isHost: boolean;
  deckType?: DeckType;
  deckValues?: VoteValue[];
  onClearHistory: () => void;
  onDeleteHistoryItems?: (historyIds: string[]) => void;
  onOpenCreatedRooms?: () => void;
  onOpenStats?: () => void;
  onArbitrate?: ArbitrateHandler;
}

const formatDuration = (totalSecs?: number) => {
  if (totalSecs === undefined || totalSecs === null) return '-';
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
};

const escapeCsvCell = (raw: unknown): string => {
  if (raw === undefined || raw === null) return '';
  let str = String(raw);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  isHost,
  deckType = 'fibonacci',
  deckValues,
  onClearHistory,
  onDeleteHistoryItems,
  onOpenCreatedRooms,
  onOpenStats,
  onArbitrate
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const activeChoices = getActiveDeckValues(deckType, deckValues);

  const filteredHistory = history.filter(item =>
    item.storyTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleSelectHistory = (id: string) => {
    setSelectedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedHistoryIds.length === filteredHistory.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(filteredHistory.map(i => i.id));
    }
  };

  const handleDeleteItems = (idsToDelete: string[]) => {
    if (!onDeleteHistoryItems || idsToDelete.length === 0) return;
    onDeleteHistoryItems(idsToDelete);
    setSelectedHistoryIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };

  const handleExportCSV = () => {
    if (history.length === 0) return;

    const header = [
      'Heure',
      'User Story',
      'Mode estimation',
      'Temps écoulé',
      'Moyenne',
      'Mode',
      'Score Back',
      'Score Front',
      'Valeur retenue',
      'Nombre de votes',
      'Détail des votes'
    ].join(',');

    const rows = history.map(item => {
      const votesStr = item.votes.map(v => {
        if (v.backValue !== undefined || v.frontValue !== undefined) {
          return `${v.userName}: BK[${v.backValue ?? '-'}] FR[${v.frontValue ?? '-'}]`;
        }
        return `${v.userName}: ${v.value ?? '-'}`;
      }).join(' | ');

      return [
        escapeCsvCell(item.timestamp),
        escapeCsvCell(item.storyTitle),
        escapeCsvCell(item.estimationMode || 'GLOBAL'),
        escapeCsvCell(formatDuration(item.durationSeconds)),
        escapeCsvCell(item.average ?? ''),
        escapeCsvCell(item.mode ?? ''),
        escapeCsvCell(item.backFinalScore ?? item.backMode ?? ''),
        escapeCsvCell(item.frontFinalScore ?? item.frontMode ?? ''),
        escapeCsvCell(item.finalScore ?? ''),
        escapeCsvCell(item.totalVotes),
        escapeCsvCell(votesStr)
      ].join(',');
    });

    const csvText = '\uFEFF' + [header, ...rows].join('\r\n') + '\r\n';
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scrum-poker-history-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Historique des votes"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-[#14171D] border-l border-[#242933] text-[#E2E8F0] w-full max-w-lg h-full p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Historique (Derniers 30)</h3>
                <p className="text-xs text-slate-500">{history.length} session{history.length > 1 ? 's' : ''} enregistrée{history.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-[#1A1D23] hover:bg-[#242933] transition-colors border border-[#242933]"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Row: Stats & Charts Button + My Created Rooms Button */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            {onOpenStats && (
              <button
                onClick={() => {
                  onClose();
                  onOpenStats();
                }}
                className="w-full p-2.5 bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 rounded-xl text-amber-200 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Charts & Stats Fun</span>
              </button>
            )}

            {onOpenCreatedRooms && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCreatedRooms();
                }}
                className="w-full p-2.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <FolderClock className="w-4 h-4 text-purple-400" />
                <span>Mes Salles Créées</span>
              </button>
            )}
          </div>

          {/* Search bar & Selection controls */}
          <div className="space-y-2 mb-4">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Filtrer par titre d'User Story..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#0B0D10] border border-[#242933] focus:border-blue-500 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>

            {isHost && history.length > 0 && (
              <div className="flex items-center justify-between text-xs px-1">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                >
                  {selectedHistoryIds.length > 0 && selectedHistoryIds.length === filteredHistory.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                  <span>
                    {selectedHistoryIds.length > 0 && selectedHistoryIds.length === filteredHistory.length
                      ? 'Tout désélectionner'
                      : 'Tout sélectionner'}
                  </span>
                </button>

                {selectedHistoryIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteItems(selectedHistoryIds)}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Supprimer ({selectedHistoryIds.length})</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* History Items List */}
        <div className="flex-1 overflow-y-auto space-y-3 my-2 pr-1 custom-scrollbar">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun vote enregistré pour l'instant.</p>
              <p className="text-xs text-slate-600 mt-1">L'historique se remplit automatiquement lors du reveal par le créateur.</p>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const displayFinalScore = item.finalScore !== undefined
                ? item.finalScore
                : (item.mode !== null ? item.mode : (item.average !== null ? Math.round(item.average) : null));
              const isSelected = selectedHistoryIds.includes(item.id);

              return (
                <div
                  key={item.id}
                  className={`border rounded-xl p-4 transition-all ${
                    isSelected
                      ? 'bg-blue-950/20 border-blue-500/60 ring-1 ring-blue-500/40'
                      : 'bg-[#1A1D23] border-[#242933] hover:border-[#303642]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleToggleSelectHistory(item.id)}
                          className="mt-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                          title={isSelected ? 'Désélectionner' : 'Sélectionner'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      )}

                      <h4 className="font-bold text-sm text-white leading-snug line-clamp-2">
                        {item.storyTitle}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {item.firstVoterName && (
                        <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          ⚡ 1er: <strong className="text-white">{item.firstVoterName}</strong>
                          {typeof item.timeToFirstVoteSeconds === 'number' ? ` (${item.timeToFirstVoteSeconds}s)` : ''}
                        </span>
                      )}
                      {item.durationSeconds !== undefined && (
                        <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-400" />
                          {formatDuration(item.durationSeconds)}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400 bg-[#0B0D10] border border-[#242933] px-2 py-0.5 rounded-md">
                        {item.timestamp}
                      </span>

                      {isHost && (
                        <button
                          type="button"
                          onClick={() => handleDeleteItems([item.id])}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                          title="Supprimer cette User Story"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Arbitrated Score Highlight Banner */}
                  <div className="bg-[#0B0D10] border border-amber-500/30 rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2 flex-wrap">
                    {item.estimationMode === 'DUAL' ? (
                      <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                        <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="text-cyan-300">⚙️ Back: <strong className="text-cyan-200">{item.backFinalScore !== undefined && item.backFinalScore !== null ? String(item.backFinalScore) : '-'}</strong></span>
                        <span className="text-fuchsia-300">🎨 Front: <strong className="text-fuchsia-200">{item.frontFinalScore !== undefined && item.frontFinalScore !== null ? String(item.frontFinalScore) : '-'}</strong></span>
                        <span className="text-amber-300 font-black">🏆 Total: <strong className="text-amber-400">{displayFinalScore !== null ? String(displayFinalScore) : '-'}</strong></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Valeur retenue :</span>
                        <span className="text-sm font-black text-amber-400">
                          {displayFinalScore !== null ? String(displayFinalScore) : '-'}
                        </span>
                      </div>
                    )}

                    {isHost && onArbitrate && (
                      <button
                        onClick={() => setEditingItemId(editingItemId === item.id ? null : item.id)}
                        className="text-[10px] font-bold text-slate-400 hover:text-amber-300 bg-[#1A1D23] border border-[#242933] hover:border-amber-500/40 px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ml-auto"
                      >
                        <Gavel className="w-3 h-3 text-amber-400" />
                        {editingItemId === item.id ? 'Fermer' : 'Arbitrer'}
                      </button>
                    )}
                  </div>

                  {/* Inline Arbitrate Selector for Host */}
                  {editingItemId === item.id && isHost && onArbitrate && (
                    <div className="mb-3 p-2.5 bg-[#0B0D10] border border-amber-500/40 rounded-lg animate-in fade-in duration-150 space-y-2.5">
                      {item.estimationMode === 'DUAL' ? (
                        <>
                          <div>
                            <p className="text-[10px] font-bold text-cyan-300 mb-1 flex items-center gap-1">
                              <span>⚙️ Arbitrer Back-end :</span>
                              <span className="text-slate-400 font-normal">({item.backFinalScore ?? 'Non défini'})</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeChoices.map(val => (
                                <button
                                  key={`hist-back-${String(val)}`}
                                  onClick={() => {
                                    onArbitrate(item.id, undefined, val, item.frontFinalScore ?? undefined);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                                    item.backFinalScore === val
                                      ? 'bg-cyan-500 text-slate-950'
                                      : 'bg-[#1A1D23] text-slate-300 hover:bg-cyan-500/30 hover:text-white border border-[#242933]'
                                  }`}
                                >
                                  {String(val)}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-[10px] font-bold text-fuchsia-300 mb-1 flex items-center gap-1">
                              <span>🎨 Arbitrer Front-end :</span>
                              <span className="text-slate-400 font-normal">({item.frontFinalScore ?? 'Non défini'})</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {activeChoices.map(val => (
                                <button
                                  key={`hist-front-${String(val)}`}
                                  onClick={() => {
                                    onArbitrate(item.id, undefined, item.backFinalScore ?? undefined, val);
                                  }}
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                                    item.frontFinalScore === val
                                      ? 'bg-fuchsia-500 text-slate-950'
                                      : 'bg-[#1A1D23] text-slate-300 hover:bg-fuchsia-500/30 hover:text-white border border-[#242933]'
                                  }`}
                                >
                                  {String(val)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 mb-1.5">Modifier la valeur finale retenue :</p>
                          <div className="flex flex-wrap gap-1">
                            {activeChoices.map(val => (
                              <button
                                key={String(val)}
                                onClick={() => {
                                  onArbitrate(item.id, val);
                                  setEditingItemId(null);
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-extrabold transition-all cursor-pointer ${
                                  item.finalScore === val
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-[#1A1D23] text-slate-300 hover:bg-amber-500/30 hover:text-white border border-[#242933]'
                                }`}
                              >
                                {String(val)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-1.5 my-3">
                    <div className="bg-[#0B0D10] border border-[#242933] rounded-lg p-2 text-center">
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                        <Calculator className="w-3 h-3 text-blue-400" /> Moy.
                      </div>
                      <div className="text-sm font-black text-blue-400 mt-0.5">
                        {item.average !== null ? item.average : '-'}
                      </div>
                    </div>

                    <div className="bg-[#0B0D10] border border-[#242933] rounded-lg p-2 text-center">
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                        <Award className="w-3 h-3 text-emerald-400" /> Mode
                      </div>
                      <div className="text-sm font-black text-emerald-400 mt-0.5">
                        {item.mode !== null ? String(item.mode) : '-'}
                      </div>
                    </div>

                    <div className="bg-[#0B0D10] border border-[#242933] rounded-lg p-2 text-center">
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-400" /> Temps
                      </div>
                      <div className="text-xs font-black text-indigo-300 mt-1 truncate">
                        {formatDuration(item.durationSeconds)}
                      </div>
                    </div>

                    <div className="bg-[#0B0D10] border border-[#242933] rounded-lg p-2 text-center">
                      <div className="text-[10px] font-semibold text-slate-500 flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-amber-400" /> Votes
                      </div>
                      <div className="text-sm font-black text-slate-200 mt-0.5">
                        {item.totalVotes}
                      </div>
                    </div>
                  </div>

                  {/* Individual Votes Breakdown */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#242933]">
                    {item.votes.map((v, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] bg-[#0B0D10] text-slate-300 border border-[#242933] px-2 py-0.5 rounded-md flex items-center gap-1.5"
                      >
                        <strong className="text-slate-200">{v.userName}:</strong>
                        {v.backValue !== undefined || v.frontValue !== undefined ? (
                          <span className="font-mono text-[9px] font-bold text-cyan-300 flex items-center gap-1">
                            <span>⚙️{String(v.backValue ?? '-')}</span>
                            <span className="text-fuchsia-300">🎨{String(v.frontValue ?? '-')}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-blue-400">{String(v.value ?? '-')}</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#242933] flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            disabled={history.length === 0}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-all ${
              history.length > 0
                ? 'bg-[#1A1D23] hover:bg-[#242933] text-slate-200 border-[#242933]'
                : 'bg-[#0B0D10] text-slate-600 border-[#242933] cursor-not-allowed'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            Exporter CSV
          </button>

          {isHost && history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="py-2.5 px-3 bg-[#0B0D10] hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-[#242933] hover:border-rose-900/50 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Vider l'historique de la salle"
            >
              <Trash2 className="w-4 h-4" />
              Effacer
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
