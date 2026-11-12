import React, { useState } from 'react';
import { BacklogItem, HistoryItem, VoteValue } from '../types';
import {
  X,
  ListTodo,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  ListPlus,
  Sparkles,
  AlignLeft,
  Check,
  Edit3,
  Layers,
  Zap,
  ArrowRight,
  CheckSquare,
  Square
} from 'lucide-react';

interface BacklogModalProps {
  isOpen: boolean;
  onClose: () => void;
  backlog: BacklogItem[];
  currentStory: string;
  history: HistoryItem[];
  isHost: boolean;
  onUpdateBacklog: (newBacklog: BacklogItem[]) => void;
  onSelectAndStartStory: (storyTitle: string) => void;
}

export const BacklogModal: React.FC<BacklogModalProps> = ({
  isOpen,
  onClose,
  backlog = [],
  currentStory,
  history = [],
  isHost,
  onUpdateBacklog,
  onSelectAndStartStory
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'batch'>('list');
  const [singleTitle, setSingleTitle] = useState('');
  const [batchText, setBatchText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === backlog.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(backlog.map(item => item.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    onUpdateBacklog(backlog.filter(item => !selectedIds.includes(item.id)));
    setSelectedIds([]);
  };

  // Helper to find if a story was already estimated in history or item score
  const getHistoryScore = (item: BacklogItem): VoteValue | null => {
    const match = history.find(
      h => h.storyTitle.trim().toLowerCase() === item.title.trim().toLowerCase()
    );
    if (match) {
      if (match.finalScore !== undefined && match.finalScore !== null) return match.finalScore;
      if (match.mode !== null) return match.mode;
      if (match.average !== null) return Math.round(match.average);
    }
    if (item.estimatedScore !== undefined && item.estimatedScore !== null) {
      return item.estimatedScore;
    }
    return null;
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = singleTitle.trim();
    if (!trimmed) return;

    const newItem: BacklogItem = {
      id: `us-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: trimmed
    };

    onUpdateBacklog([...backlog, newItem]);
    setSingleTitle('');
  };

  const handleBatchAdd = (replace: boolean = false) => {
    const lines = batchText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (lines.length === 0) return;

    const newItems: BacklogItem[] = lines.map((title, index) => ({
      id: `us-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
      title
    }));

    if (replace) {
      onUpdateBacklog(newItems);
    } else {
      onUpdateBacklog([...backlog, ...newItems]);
    }

    setBatchText('');
    setActiveTab('list');
  };

  const handleDeleteItem = (id: string) => {
    onUpdateBacklog(backlog.filter(item => item.id !== id));
  };

  const handleClearAll = () => {
    onUpdateBacklog([]);
  };

  const handleStartEditing = (item: BacklogItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleSaveEditing = (id: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;

    onUpdateBacklog(
      backlog.map(item => (item.id === id ? { ...item, title: trimmed } : item))
    );
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#14171D] border border-[#242933] text-[#E2E8F0] w-full max-w-2xl max-h-[85vh] rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative">
        {/* Modal Header */}
        <div className="shrink-0 pb-4 border-b border-[#242933]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <ListTodo className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                  Préparation du Backlog
                  <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold px-2 py-0.5 rounded-full">
                    {backlog.length} US
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Saisissez vos User Stories à l'avance pour enchaîner les chiffrages durant la session.
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

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-2 bg-[#0B0D10] p-1 rounded-xl border border-[#242933]">
            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14171D]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Liste des US ({backlog.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'batch'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14171D]'
              }`}
            >
              <ListPlus className="w-3.5 h-3.5" />
              <span>Saisie rapide en lot (Copier/Coller)</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4 custom-scrollbar">
          {activeTab === 'list' ? (
            <>
              {/* Single US add input */}
              <form onSubmit={handleAddSingle} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: US-05: Authentification à deux facteurs (2FA)..."
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="flex-1 bg-[#0B0D10] border border-[#242933] focus:border-blue-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={!singleTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
              </form>

              {/* Selection Bar */}
              {isHost && backlog.length > 0 && (
                <div className="flex items-center justify-between text-xs px-1 py-1">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 font-bold cursor-pointer"
                  >
                    {selectedIds.length > 0 && selectedIds.length === backlog.length ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-500" />
                    )}
                    <span>
                      {selectedIds.length > 0 && selectedIds.length === backlog.length
                        ? 'Tout désélectionner'
                        : 'Tout sélectionner'}
                    </span>
                  </button>

                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Supprimer ({selectedIds.length})</span>
                    </button>
                  )}
                </div>
              )}

              {/* List of backlog items */}
              {backlog.length === 0 ? (
                <div className="text-center py-10 px-4 bg-[#1A1D23]/40 border border-[#242933] rounded-2xl">
                  <ListTodo className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-40" />
                  <h4 className="text-sm font-bold text-slate-300">Aucune User Story préparée</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Saisissez vos titres d'US ci-dessus ou basculez sur l'onglet "Saisie en lot" pour en coller plusieurs d'un coup.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {backlog.map((item, index) => {
                    const isActive = item.title.trim().toLowerCase() === currentStory.trim().toLowerCase();
                    const score = getHistoryScore(item);
                    const isSelected = selectedIds.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`group border rounded-xl p-3 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-blue-950/20 border-blue-500/60 ring-1 ring-blue-500/40'
                            : isActive
                            ? 'border-blue-500/60 bg-blue-950/20 shadow-md shadow-blue-950/30'
                            : 'bg-[#1A1D23] border-[#242933] hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                          {isHost && (
                            <button
                              type="button"
                              onClick={() => handleToggleSelect(item.id)}
                              className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                              title={isSelected ? 'Désélectionner' : 'Sélectionner'}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-blue-400" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-600" />
                              )}
                            </button>
                          )}

                          <span className="font-mono text-xs font-bold text-slate-500 bg-[#0B0D10] border border-[#242933] px-2 py-1 rounded-lg shrink-0">
                            #{index + 1}
                          </span>

                          {editingId === item.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editingTitle}
                                onChange={(e) => setEditingTitle(e.target.value)}
                                className="flex-1 bg-[#0B0D10] border border-blue-500 rounded-lg px-2.5 py-1 text-xs text-white outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveEditing(item.id)}
                                className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold truncate ${isActive ? 'text-blue-300' : 'text-slate-200'}`}>
                                  {item.title}
                                </span>

                                {isActive && (
                                  <span className="text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Zap className="w-3 h-3 text-blue-400 animate-pulse" /> En cours
                                  </span>
                                )}

                                {score !== null && score !== undefined && (
                                  <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    Chiffré: {score} {typeof score === 'number' ? 'SP' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 shrink-0 justify-end">
                          {editingId !== item.id && (
                            <button
                              onClick={() => handleStartEditing(item)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-[#242933] transition-colors"
                              title="Modifier"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              onSelectAndStartStory(item.title);
                              onClose();
                            }}
                            className={`px-3 py-1.5 font-extrabold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                              isActive
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40 cursor-default'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/40'
                            }`}
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{isActive ? 'Relancer' : 'Go 🚀'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* Batch Input Tab */
            <div className="space-y-3">
              <div className="bg-[#0B0D10] border border-[#242933] p-3 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
                <AlignLeft className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Saisie ou collage multi-lignes :</strong>
                  <p className="mt-0.5">
                    Collez votre liste de User Stories issues de Jira, Trello ou Notion (une User Story par ligne).
                  </p>
                </div>
              </div>

              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={8}
                placeholder={`US-01: Authentification Google\nUS-02: Profil utilisateur\nUS-03: Export PDF des rapports\nUS-[#101010]: Paiement Stripe`}
                className="w-full bg-[#0B0D10] border border-[#242933] focus:border-blue-500 rounded-xl p-3.5 text-xs font-mono text-white placeholder-slate-600 outline-none leading-relaxed transition-all"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                {backlog.length > 0 && (
                  <button
                    onClick={() => handleBatchAdd(true)}
                    disabled={!batchText.trim()}
                    className="px-4 py-2 bg-[#1A1D23] hover:bg-rose-900/30 text-rose-300 hover:text-rose-200 border border-rose-500/30 font-bold rounded-xl text-xs transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Remplacer la liste
                  </button>
                )}
                <button
                  onClick={() => handleBatchAdd(false)}
                  disabled={!batchText.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-blue-950/40 disabled:opacity-40 flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter ces US au backlog</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 pt-3 border-t border-[#242933] flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            {backlog.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider la liste</span>
              </button>
            )}
          </div>

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
