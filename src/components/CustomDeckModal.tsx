import React, { useState } from 'react';
import { VoteValue } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sliders,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Sparkles,
  Layers,
  HelpCircle,
  Coffee,
  Infinity as InfinityIcon
} from 'lucide-react';
import { DECK_PRESETS } from '../constants/avatars';

interface CustomDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValues?: VoteValue[];
  onApplyCustomDeck: (values: VoteValue[]) => void;
}

const POPULAR_TEMPLATES: { label: string; values: VoteValue[] }[] = [
  {
    label: 'Fibonacci Standard',
    values: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕']
  },
  {
    label: 'Fibonacci Épuré',
    values: [0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕']
  },
  {
    label: 'T-Shirt (XS-XXL)',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']
  },
  {
    label: 'Puissances de 2',
    values: [1, 2, 4, 8, 16, 32, 64, '?', '☕']
  },
  {
    label: 'Linéaire 1 à 10',
    values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '?', '☕']
  },
  {
    label: 'Heures / Jours',
    values: ['0.5', '1', '2', '4', '8', '16', '24', '40', '?', '☕']
  }
];

const SPECIAL_TOKENS: { label: string; value: VoteValue; icon?: React.ReactNode }[] = [
  { label: '0', value: 0 },
  { label: '0.5', value: 0.5 },
  { label: '1/2', value: '1/2' },
  { label: '100', value: 100 },
  { label: '?', value: '?', icon: <HelpCircle className="w-3 h-3" /> },
  { label: '☕', value: '☕', icon: <Coffee className="w-3 h-3" /> },
  { label: '∞', value: '∞', icon: <InfinityIcon className="w-3 h-3" /> }
];

export const CustomDeckModal: React.FC<CustomDeckModalProps> = ({
  isOpen,
  onClose,
  initialValues,
  onApplyCustomDeck
}) => {
  const [cards, setCards] = useState<VoteValue[]>(() => {
    if (initialValues && initialValues.length > 0) {
      return [...initialValues];
    }
    return [0, 1, 2, 3, 5, 8, 13, 20, 40, '?', '☕'];
  });

  const [newCardInput, setNewCardInput] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkTextInput, setBulkTextInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddCard = (valToAdd?: VoteValue) => {
    setErrorMsg(null);
    const raw = valToAdd !== undefined ? String(valToAdd) : newCardInput.trim();
    if (!raw) return;

    // Parse number if strictly numerical
    const num = parseFloat(raw);
    const value: VoteValue = !isNaN(num) && String(num) === raw ? num : raw;

    if (cards.includes(value)) {
      setErrorMsg(`La carte "${value}" existe déjà dans le deck.`);
      return;
    }

    if (cards.length >= 24) {
      setErrorMsg("Limite maximale de 24 cartes atteinte.");
      return;
    }

    setCards([...cards, value]);
    setNewCardInput('');
  };

  const handleRemoveCard = (index: number) => {
    setErrorMsg(null);
    if (cards.length <= 2) {
      setErrorMsg("Le deck doit contenir au moins 2 cartes.");
      return;
    }
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleMoveCard = (index: number, direction: 'left' | 'right') => {
    setErrorMsg(null);
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const updated = [...cards];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setCards(updated);
  };

  const handleApplyTemplate = (templateValues: VoteValue[]) => {
    setErrorMsg(null);
    setCards([...templateValues]);
    setBulkTextInput(templateValues.join(', '));
  };

  const handleApplyBulk = () => {
    setErrorMsg(null);
    const items = bulkTextInput
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (items.length < 2) {
      setErrorMsg("Veuillez saisir au moins 2 cartes valides (séparées par une virgule ou un espace).");
      return;
    }

    const uniqueValues: VoteValue[] = [];
    items.forEach(raw => {
      const num = parseFloat(raw);
      const val: VoteValue = !isNaN(num) && String(num) === raw ? num : raw;
      if (!uniqueValues.includes(val) && uniqueValues.length < 24) {
        uniqueValues.push(val);
      }
    });

    setCards(uniqueValues);
    setIsBulkMode(false);
  };

  const handleSave = () => {
    if (cards.length < 2) {
      setErrorMsg("Veuillez configurer au moins 2 cartes pour votre deck.");
      return;
    }
    onApplyCustomDeck(cards);
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Échelle d'estimation sur-mesure"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className="bg-[#12161F] border border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0E1219]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  Échelle d'estimation sur-mesure
                </h3>
                <p className="text-xs text-slate-400">
                  Définissez précisément les cartes et valeurs soumises au vote de votre équipe.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
            {/* Template Presets */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                Modèles de départ rapides
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {POPULAR_TEMPLATES.map(tpl => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => handleApplyTemplate(tpl.values)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{tpl.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Deck Cards Preview */}
            <div className="bg-[#0A0D14] border border-slate-800/80 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Aperçu de la main de vote ({cards.length} carte{cards.length > 1 ? 's' : ''})
                </span>
                <span className="text-[10px] text-slate-500">
                  Visible par tous les votants
                </span>
              </div>

              {/* Visual Card List */}
              <div className="flex items-center gap-2 flex-wrap min-h-[70px] p-2 bg-slate-950/60 rounded-lg border border-slate-800/60">
                {cards.map((val, idx) => (
                  <div
                    key={`${String(val)}-${idx}`}
                    className="group relative flex flex-col items-center bg-slate-900 border border-indigo-500/40 hover:border-indigo-400 rounded-lg px-2.5 py-1.5 min-w-[42px] transition-all shadow-sm"
                  >
                    <span className="font-bold text-sm text-indigo-200">{String(val)}</span>

                    {/* Reorder and Delete Mini Overlay */}
                    <div className="flex items-center gap-0.5 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, 'left')}
                          className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="Déplacer vers la gauche"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCard(idx)}
                        className="p-0.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded transition-colors cursor-pointer"
                        title="Supprimer cette carte"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {idx < cards.length - 1 && (
                        <button
                          type="button"
                          onClick={() => handleMoveCard(idx, 'right')}
                          className="p-0.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                          title="Déplacer vers la droite"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <X className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Single Card Addition & Quick Tokens */}
            {!isBulkMode ? (
              <div className="space-y-3">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Ajouter une carte
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newCardInput}
                      onChange={(e) => setNewCardInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCard();
                        }
                      }}
                      placeholder="Ex: 0.5, 3, 20, XXL, ?, ☕..."
                      maxLength={10}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddCard()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBulkTextInput(cards.join(', '));
                      setIsBulkMode(true);
                    }}
                    className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  >
                    Saisie groupée
                  </button>
                </div>

                {/* Quick Tokens */}
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1.5">
                    Symboles et cartes fréquentes :
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {SPECIAL_TOKENS.map((token) => (
                      <button
                        key={String(token.label)}
                        type="button"
                        onClick={() => handleAddCard(token.value)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {token.icon}
                        <span>{token.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Bulk Mode Textarea */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Saisie groupée (valeurs séparées par virgule ou espace)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsBulkMode(false)}
                    className="text-xs text-indigo-400 hover:underline cursor-pointer"
                  >
                    Retour au mode pas-à-pas
                  </button>
                </div>
                <textarea
                  value={bulkTextInput}
                  onChange={(e) => setBulkTextInput(e.target.value)}
                  placeholder="Ex: 0, 1, 2, 3, 5, 8, 13, 20, 40, ?, ☕"
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none font-mono transition-colors"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleApplyBulk}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Valider la liste
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0E1219] flex-wrap gap-3">
            <button
              type="button"
              onClick={() => handleApplyTemplate(DECK_PRESETS.fibonacci.values)}
              className="px-3 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rétablir Fibonacci
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Appliquer à la salle
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
