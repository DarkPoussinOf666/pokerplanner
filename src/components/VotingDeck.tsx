import React, { useState, useEffect } from 'react';
import { DeckType, VoteValue } from '../types';
import { motion } from 'motion/react';
import {
  Check,
  Lock,
  Eye,
  UserCheck,
  Server,
  Layout,
  Layers,
  Sparkles,
  SlidersHorizontal,
  Pencil,
  ChevronDown
} from 'lucide-react';
import { DECK_PRESETS } from '../constants/avatars';
import { CustomDeckModal } from './CustomDeckModal';

interface VotingDeckProps {
  deckType?: DeckType;
  deckValues?: VoteValue[];
  estimationMode?: 'GLOBAL' | 'DUAL';
  selectedVote?: VoteValue;
  selectedBackVote?: VoteValue;
  selectedFrontVote?: VoteValue;
  onSelectVote: (val: VoteValue, dimension?: 'GLOBAL' | 'BACK' | 'FRONT') => void;
  isRevealed: boolean;
  disabled?: boolean;
  isSpectator?: boolean;
  onToggleSpectator?: () => void;
  isHost?: boolean;
  onToggleEstimationMode?: (mode: 'GLOBAL' | 'DUAL') => void;
  onChangeDeckType?: (deckType: DeckType, customValues?: VoteValue[]) => void;
}

const CARD_KEY_SHORTCUTS: Record<string, string> = {
  '0': '0',
  '1': '1',
  '2': '2',
  '3': '3',
  '5': '5',
  '8': '8',
  '13': '6',
  '21': '7',
  '34': '9',
  'XS': '1',
  'S': '2',
  'M': '3',
  'L': '4',
  'XL': '5'
};

export const VotingDeck: React.FC<VotingDeckProps> = ({
  deckType = 'fibonacci',
  deckValues,
  estimationMode = 'GLOBAL',
  selectedVote,
  selectedBackVote,
  selectedFrontVote,
  onSelectVote,
  isRevealed,
  disabled = false,
  isSpectator = false,
  onToggleSpectator,
  isHost,
  onToggleEstimationMode,
  onChangeDeckType
}) => {
  const [activeDualTab, setActiveDualTab] = useState<'BACK' | 'FRONT'>('BACK');
  const [isDeckMenuOpen, setIsDeckMenuOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const activePreset = DECK_PRESETS[deckType] || DECK_PRESETS.fibonacci;
  const cards: VoteValue[] = (deckType === 'custom' && deckValues && deckValues.length > 0)
    ? deckValues
    : activePreset.values;

  // Auto switch tab if one dimension is already selected in dual mode
  useEffect(() => {
    if (estimationMode === 'DUAL') {
      if (selectedBackVote !== undefined && selectedFrontVote === undefined) {
        setActiveDualTab('FRONT');
      }
    }
  }, [estimationMode, selectedBackVote, selectedFrontVote]);

  if (isSpectator) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#12161F] border border-indigo-500/20 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-sm font-semibold text-white">Mode Spectateur</h3>
                <span className="text-[10px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                  Observation
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Vous observez l'estimation en direct sans carte de vote active.
              </p>
            </div>
          </div>

          {onToggleSpectator && (
            <button
              onClick={onToggleSpectator}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <UserCheck className="w-4 h-4" />
              Prendre part au vote
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  const handleCardClick = (val: VoteValue) => {
    if (disabled || isRevealed) return;

    if (estimationMode === 'DUAL') {
      onSelectVote(val, activeDualTab);
    } else {
      onSelectVote(val, 'GLOBAL');
    }
  };

  const handleApplyCustomDeck = (newValues: VoteValue[]) => {
    if (onChangeDeckType) {
      onChangeDeckType('custom', newValues);
    }
  };

  const isDual = estimationMode === 'DUAL';

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-2.5">
      {/* Custom Deck Modal */}
      <CustomDeckModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        initialValues={cards}
        onApplyCustomDeck={handleApplyCustomDeck}
      />

      {/* Header Controls Bar */}
      <div className="flex flex-col gap-2.5 mb-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Status info */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              {isDual ? <Layers className="w-3.5 h-3.5 text-indigo-400" /> : null}
              {isDual ? 'Double Estimation (Back & Front)' : 'Votre estimation'}
            </span>

            {!isDual && selectedVote !== undefined && !isRevealed && (
              <span className="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Check className="w-3 h-3 text-indigo-400" /> Choix : <strong className="font-bold">{String(selectedVote)}</strong>
              </span>
            )}
          </div>

          {/* Controls: Deck switcher & Dual Mode & Spectator */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Deck Selector Button */}
            {isHost && onChangeDeckType && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDeckMenuOpen(!isDeckMenuOpen)}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Changer ou personnaliser l'échelle d'estimation"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {deckType === 'custom' ? 'Personnalisée' : activePreset.label.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>

                {isDeckMenuOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-64 bg-[#161A23] border border-slate-700/80 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400 px-2.5 py-1 tracking-wider border-b border-slate-800 flex items-center justify-between">
                      <span>Échelle d'estimation</span>
                      <span className="text-[9px] text-indigo-400 lowercase">{cards.length} cartes</span>
                    </div>

                    {/* Standard Presets */}
                    {Object.values(DECK_PRESETS).filter(p => p.id !== 'custom').map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onChangeDeckType(preset.id);
                          setIsDeckMenuOpen(false);
                        }}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex flex-col cursor-pointer ${
                          deckType === preset.id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{preset.label}</span>
                          {deckType === preset.id && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-[10px] truncate ${deckType === preset.id ? 'text-indigo-200' : 'text-slate-400'}`}>
                          {preset.description}
                        </span>
                      </button>
                    ))}

                    <div className="my-1 border-t border-slate-800" />

                    {/* Custom Deck Action Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDeckMenuOpen(false);
                        setIsCustomModalOpen(true);
                      }}
                      className={`text-left px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                        deckType === 'custom'
                          ? 'bg-indigo-500/20 text-indigo-200 border border-indigo-500/30'
                          : 'text-indigo-300 hover:bg-indigo-950/40 hover:text-white border border-indigo-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Personnaliser l'échelle...</span>
                      </div>
                      {deckType === 'custom' && (
                        <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.2 rounded font-bold">
                          Active
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Estimation mode toggle */}
            {onToggleEstimationMode && (
              <button
                type="button"
                disabled={!isHost}
                onClick={() => onToggleEstimationMode(isDual ? 'GLOBAL' : 'DUAL')}
                className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                  isDual
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                } ${isHost ? 'cursor-pointer hover:border-slate-700' : 'cursor-default'}`}
                title={
                  isHost
                    ? `Basculer mode d'estimation (Actuel : ${isDual ? 'Double Vote' : 'Vote Unique'})`
                    : `Mode d'estimation : ${isDual ? 'Double Vote' : 'Vote Unique'}`
                }
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>{isDual ? 'Double Vote' : 'Vote Unique'}</span>
              </button>
            )}

            {onToggleSpectator && (
              <button
                type="button"
                onClick={onToggleSpectator}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Passer en spectateur"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Spectateur</span>
              </button>
            )}

            {isRevealed && (
              <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1 font-medium">
                <Lock className="w-3 h-3" /> Clôturé
              </span>
            )}
          </div>
        </div>

        {/* Dual Mode Switcher Tabs */}
        {isDual && (
          <div className="bg-[#12161F] border border-slate-800 p-1 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setActiveDualTab('BACK')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDualTab === 'BACK'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>1. Back-End</span>
                {selectedBackVote !== undefined && (
                  <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {String(selectedBackVote)}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveDualTab('FRONT')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeDualTab === 'FRONT'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layout className="w-3.5 h-3.5" />
                <span>2. Front-End</span>
                {selectedFrontVote !== undefined && (
                  <span className="bg-white/20 text-white px-1.5 py-0.2 rounded-full text-[10px] font-bold">
                    {String(selectedFrontVote)}
                  </span>
                )}
              </button>
            </div>

            {typeof selectedBackVote === 'number' && typeof selectedFrontVote === 'number' && (
              <div className="text-xs text-emerald-400 font-semibold px-2">
                Total estimé : {selectedBackVote + selectedFrontVote} SP
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards Deck Horizontal Matrix */}
      <div className="flex flex-wrap sm:flex-nowrap sm:overflow-x-auto gap-2 sm:gap-2.5 pb-2 scrollbar-hide justify-center sm:justify-start">
        {cards.map((val) => {
          const currentTabVote = isDual
            ? (activeDualTab === 'BACK' ? selectedBackVote : selectedFrontVote)
            : selectedVote;

          const isSelected = currentTabVote === val;
          const isDisabled = disabled || isRevealed;
          const keyShortcut = CARD_KEY_SHORTCUTS[String(val)];

          return (
            <motion.button
              key={String(val)}
              whileHover={!isDisabled ? { y: -4 } : {}}
              whileTap={!isDisabled ? { scale: 0.96 } : {}}
              onClick={() => handleCardClick(val)}
              disabled={isDisabled}
              className={`relative min-w-[50px] sm:min-w-[62px] flex-1 h-20 sm:h-24 rounded-xl border flex flex-col items-center justify-between p-2 font-bold transition-colors select-none ${
                isSelected
                  ? 'bg-indigo-600 border-indigo-400 text-white -translate-y-1.5 shadow-lg shadow-indigo-950/60'
                  : isDisabled
                  ? 'bg-[#12161F] border-slate-800/80 text-slate-600 opacity-40 cursor-not-allowed'
                  : 'bg-[#141822] border-slate-800 hover:border-slate-600 hover:bg-[#1C2230] text-slate-200'
              }`}
            >
              <div className="text-base sm:text-xl font-bold tracking-tight truncate max-w-full">
                {String(val)}
              </div>

              <div className="w-full flex justify-between items-center text-[10px] opacity-70">
                {keyShortcut ? (
                  <kbd className="text-[9px] font-mono px-1 rounded bg-black/30 text-slate-400 border border-slate-800 leading-none">
                    {keyShortcut}
                  </kbd>
                ) : (
                  <span />
                )}
                <span className="text-[9px] truncate max-w-[32px]">{String(val)}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
