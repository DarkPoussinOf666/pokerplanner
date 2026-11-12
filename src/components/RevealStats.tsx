import React, { useState } from 'react';
import { ParticipantVote, VoteValue, HistoryItem, DeckType } from '../types';
import { motion } from 'motion/react';
import {
  Calculator,
  Award,
  Users,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Crown,
  Gavel,
  Check
} from 'lucide-react';
import { AvatarDisplay } from './AvatarDisplay';
import { DECK_PRESETS } from '../constants/avatars';

interface RevealStatsProps {
  deckType?: DeckType;
  deckValues?: VoteValue[];
  estimationMode?: 'GLOBAL' | 'DUAL';
  participants: Record<string, ParticipantVote>;
  currentStory: string;
  isHost?: boolean;
  currentHistoryItem?: HistoryItem;
  onArbitrate?: (historyId: string, finalScore: VoteValue, backFinalScore?: VoteValue, frontFinalScore?: VoteValue) => void;
}

export const RevealStats: React.FC<RevealStatsProps> = ({
  deckType = 'fibonacci',
  deckValues,
  estimationMode = 'GLOBAL',
  participants,
  currentStory,
  isHost,
  currentHistoryItem,
  onArbitrate
}) => {
  const [customValue, setCustomValue] = useState<string>('');
  const [customBackValue, setCustomBackValue] = useState<string>('');
  const [customFrontValue, setCustomFrontValue] = useState<string>('');
  const isDual = estimationMode === 'DUAL';

  const deckChoices = (deckType === 'custom' && deckValues && deckValues.length > 0)
    ? deckValues
    : (DECK_PRESETS[deckType]?.values || DECK_PRESETS.fibonacci.values);
  const votesList = (Object.values(participants || {}) as ParticipantVote[]).filter(p => p.hasVoted);

  // Helper for stats calculation
  const getDimensionStats = (getter: (p: ParticipantVote) => VoteValue | undefined) => {
    const validVotes = votesList.filter(p => getter(p) !== undefined);
    const numericVotes = validVotes
      .map(p => getter(p))
      .filter((v): v is number => typeof v === 'number');

    const average = numericVotes.length > 0
      ? Math.round((numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length) * 10) / 10
      : null;

    const distribution: Record<string, number> = {};
    validVotes.forEach(p => {
      const v = getter(p);
      if (v !== undefined) {
        const key = String(v);
        distribution[key] = (distribution[key] || 0) + 1;
      }
    });

    let mode: VoteValue | null = null;
    let maxCount = 0;
    let topValues: string[] = [];

    Object.entries(distribution).forEach(([valStr, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topValues = [valStr];
      } else if (count === maxCount) {
        topValues.push(valStr);
      }
    });

    if (topValues.length === 1 && (validVotes.length === 1 || maxCount > 1)) {
      const valStr = topValues[0];
      const parsed = parseFloat(valStr);
      if (!isNaN(parsed) && valStr !== '☕' && valStr !== '?') {
        mode = parsed;
      } else {
        mode = valStr as VoteValue;
      }
    }

    return { validVotes, numericVotes, average, distribution, mode, maxCount };
  };

  const globalStats = getDimensionStats(p => p.value);
  const backStats = getDimensionStats(p => p.backValue);
  const frontStats = getDimensionStats(p => p.frontValue);

  const numericVotes = isDual
    ? [...backStats.numericVotes, ...frontStats.numericVotes]
    : globalStats.numericVotes;

  const average = isDual
    ? (typeof backStats.average === 'number' && typeof frontStats.average === 'number'
        ? Math.round((backStats.average + frontStats.average) * 10) / 10
        : (backStats.average ?? frontStats.average ?? null))
    : globalStats.average;

  const activeDistribution = globalStats.distribution;
  const maxCount = isDual
    ? Math.max(backStats.maxCount, frontStats.maxCount)
    : globalStats.maxCount;
  const activeMode = globalStats.mode;

  // Consensus Status
  const backConsensus = isDual && backStats.numericVotes.length > 0 && backStats.numericVotes.every(v => v === backStats.numericVotes[0]);
  const frontConsensus = isDual && frontStats.numericVotes.length > 0 && frontStats.numericVotes.every(v => v === frontStats.numericVotes[0]);
  const globalConsensus = !isDual && globalStats.numericVotes.length > 0 && globalStats.numericVotes.every(v => v === globalStats.numericVotes[0]);

  const isPerfectConsensus = isDual ? (backConsensus && frontConsensus) : globalConsensus;

  const minVal = numericVotes.length > 0 ? Math.min(...numericVotes) : null;
  const maxVal = numericVotes.length > 0 ? Math.max(...numericVotes) : null;

  const backSpread = isDual && backStats.numericVotes.length > 0 && (Math.max(...backStats.numericVotes) - Math.min(...backStats.numericVotes) >= 5);
  const frontSpread = isDual && frontStats.numericVotes.length > 0 && (Math.max(...frontStats.numericVotes) - Math.min(...frontStats.numericVotes) >= 5);
  const globalSpread = !isDual && minVal !== null && maxVal !== null && (maxVal - minVal >= 5);

  const hasSpread = isDual ? (backSpread || frontSpread) : globalSpread;

  const nearestDeckValue = (num: number): VoteValue => {
    const numCards = deckChoices.filter((c): c is number => typeof c === 'number');
    if (numCards.length === 0) return num;
    return numCards.reduce((prev, curr) => (Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev));
  };

  const backActiveScore = currentHistoryItem?.backFinalScore !== undefined
    ? currentHistoryItem.backFinalScore
    : (backStats.mode !== null ? backStats.mode : (backStats.average !== null ? nearestDeckValue(backStats.average) : null));

  const frontActiveScore = currentHistoryItem?.frontFinalScore !== undefined
    ? currentHistoryItem.frontFinalScore
    : (frontStats.mode !== null ? frontStats.mode : (frontStats.average !== null ? nearestDeckValue(frontStats.average) : null));

  const activeFinalScore = currentHistoryItem?.finalScore !== undefined
    ? currentHistoryItem.finalScore
    : (isDual
        ? (typeof backActiveScore === 'number' && typeof frontActiveScore === 'number'
            ? backActiveScore + frontActiveScore
            : null)
        : (activeMode !== null ? activeMode : (average !== null ? nearestDeckValue(average) : null)));

  const handleSelectArbitrate = (val: VoteValue, dimension: 'GLOBAL' | 'BACK' | 'FRONT' = 'GLOBAL') => {
    if (!onArbitrate) return;
    const targetHistoryId = currentHistoryItem?.id || 'current';
    if (dimension === 'BACK') {
      onArbitrate(targetHistoryId, undefined, val, currentHistoryItem?.frontFinalScore ?? (frontActiveScore ?? undefined));
    } else if (dimension === 'FRONT') {
      onArbitrate(targetHistoryId, undefined, currentHistoryItem?.backFinalScore ?? (backActiveScore ?? undefined), val);
    } else {
      onArbitrate(targetHistoryId, val);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent, dimension: 'GLOBAL' | 'BACK' | 'FRONT' = 'GLOBAL') => {
    e.preventDefault();
    if (!onArbitrate) return;
    const targetHistoryId = currentHistoryItem?.id || 'current';

    if (dimension === 'BACK') {
      const num = parseFloat(customBackValue);
      const val = !isNaN(num) ? num : (customBackValue.trim() || undefined);
      if (val !== undefined) {
        onArbitrate(targetHistoryId, undefined, val, currentHistoryItem?.frontFinalScore ?? (frontActiveScore ?? undefined));
        setCustomBackValue('');
      }
    } else if (dimension === 'FRONT') {
      const num = parseFloat(customFrontValue);
      const val = !isNaN(num) ? num : (customFrontValue.trim() || undefined);
      if (val !== undefined) {
        onArbitrate(targetHistoryId, undefined, currentHistoryItem?.backFinalScore ?? (backActiveScore ?? undefined), val);
        setCustomFrontValue('');
      }
    } else {
      const num = parseFloat(customValue);
      const val = !isNaN(num) ? num : (customValue.trim() || undefined);
      if (val !== undefined) {
        onArbitrate(targetHistoryId, val);
        setCustomValue('');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-5xl mx-auto px-4 my-4"
    >
      <div className="bg-[#12161F] border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5 border-b border-slate-800 pb-3.5 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Clôture du tour
              </span>
              {currentHistoryItem?.firstVoterName && (
                <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                  ⚡ 1er à voter : <strong className="text-white">{currentHistoryItem.firstVoterName}</strong>
                  {typeof currentHistoryItem.timeToFirstVoteSeconds === 'number' ? ` (${currentHistoryItem.timeToFirstVoteSeconds}s)` : ''}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-100">{currentStory}</h3>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> {votesList.length} votant{votesList.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Arbitration Banner */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                <Gavel className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Arbitrage & Chiffrage Consensus
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                </h4>
                <p className="text-[11px] text-slate-400">
                  {isHost
                    ? "Définissez ou ajustez la valeur retenue pour l'US (enregistrée dans l'historique et le backlog)."
                    : "Valeur de consensus retenue par le Scrum Master / PO."}
                </p>
              </div>
            </div>

            {isDual ? (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300">
                  <span>Back :</span>
                  <span className="font-bold text-indigo-300">{backActiveScore !== null ? String(backActiveScore) : '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300">
                  <span>Front :</span>
                  <span className="font-bold text-indigo-300">{frontActiveScore !== null ? String(frontActiveScore) : '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500/40 px-3 py-1 rounded-lg text-xs font-bold text-indigo-200">
                  <span>Total :</span>
                  <span className="font-extrabold text-white">{activeFinalScore !== null ? String(activeFinalScore) : '-'}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg">
                <span className="text-xs text-slate-400">Score retenu :</span>
                <span className="text-sm font-bold text-indigo-300">
                  {activeFinalScore !== null ? String(activeFinalScore) : 'Non défini'}
                </span>
              </div>
            )}
          </div>

          {/* Quick choices and custom input for Host */}
          {isHost && (
            <div className="pt-3 border-t border-slate-800">
              {isDual ? (
                <div className="space-y-3">
                  {/* Back-End Selection */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Estimation Back-End :</span>
                      {backActiveScore !== null && (
                        <span className="text-indigo-300 font-bold text-xs">Actuel : {String(backActiveScore)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {deckChoices.map(val => {
                        const isSelected = backActiveScore === val;
                        return (
                          <button
                            key={`back-${String(val)}`}
                            type="button"
                            onClick={() => handleSelectArbitrate(val, 'BACK')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{String(val)}</span>
                          </button>
                        );
                      })}

                      {/* Custom input for Back */}
                      <form onSubmit={(e) => handleCustomSubmit(e, 'BACK')} className="flex items-center gap-1 ml-1">
                        <input
                          type="text"
                          value={customBackValue}
                          onChange={(e) => setCustomBackValue(e.target.value)}
                          placeholder="Autre..."
                          className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!customBackValue.trim()}
                          className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
                        >
                          OK
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Front-End Selection */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                      <span>Estimation Front-End :</span>
                      {frontActiveScore !== null && (
                        <span className="text-indigo-300 font-bold text-xs">Actuel : {String(frontActiveScore)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {deckChoices.map(val => {
                        const isSelected = frontActiveScore === val;
                        return (
                          <button
                            key={`front-${String(val)}`}
                            type="button"
                            onClick={() => handleSelectArbitrate(val, 'FRONT')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{String(val)}</span>
                          </button>
                        );
                      })}

                      {/* Custom input for Front */}
                      <form onSubmit={(e) => handleCustomSubmit(e, 'FRONT')} className="flex items-center gap-1 ml-1">
                        <input
                          type="text"
                          value={customFrontValue}
                          onChange={(e) => setCustomFrontValue(e.target.value)}
                          placeholder="Autre..."
                          className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          disabled={!customFrontValue.trim()}
                          className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
                        >
                          OK
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Sélectionner la valeur finale :</span>
                    {activeFinalScore !== null && (
                      <span className="text-indigo-300 font-bold text-xs">Actuel : {String(activeFinalScore)} SP</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {deckChoices.map(val => {
                      const isSelected = activeFinalScore === val;
                      return (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => handleSelectArbitrate(val, 'GLOBAL')}
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{String(val)}</span>
                        </button>
                      );
                    })}

                    {/* Custom input for Global */}
                    <form onSubmit={(e) => handleCustomSubmit(e, 'GLOBAL')} className="flex items-center gap-1 ml-1">
                      <input
                        type="text"
                        value={customValue}
                        onChange={(e) => setCustomValue(e.target.value)}
                        placeholder="Autre..."
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!customValue.trim()}
                        className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 disabled:opacity-40 text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
                      >
                        OK
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400 shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Moyenne
              </div>
              <div className="text-xl font-bold text-white tracking-tight mt-0.5">
                {average !== null ? average : 'N/A'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Plus voté (Mode)
              </div>
              <div className="text-xl font-bold text-white tracking-tight mt-0.5">
                {activeMode !== null ? String(activeMode) : 'N/A'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border shrink-0 ${
              isPerfectConsensus
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : hasSpread
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}>
              {isPerfectConsensus ? (
                <Sparkles className="w-5 h-5" />
              ) : hasSpread ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <TrendingUp className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Consensus
              </div>
              <div className="text-xs font-semibold text-white mt-0.5">
                {isPerfectConsensus
                  ? 'Unanimité'
                  : hasSpread
                  ? 'Écart important'
                  : 'Aligné'}
              </div>
            </div>
          </div>
        </div>

        {/* Distribution Matrix */}
        <div className="mb-6">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Répartition des votes
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
            {Object.entries(activeDistribution).map(([valStr, count]) => {
              const voteCount = Number(count);
              const percentage = votesList.length > 0 ? Math.round((voteCount / votesList.length) * 100) : 0;
              return (
                <div key={valStr} className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 text-center">
                  <div className="text-base font-bold text-white">{valStr}</div>
                  <div className="text-[11px] text-indigo-300 font-semibold">{voteCount} vote{voteCount > 1 ? 's' : ''}</div>
                  <div className="text-[10px] text-slate-500">{percentage}%</div>
                  <div className="w-full bg-slate-950 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed votes list */}
        <div>
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
            Détail par participant
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {votesList.map((p) => (
              <div
                key={p.userId}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarDisplay 
                    user={p} 
                    className="w-7 h-7 shrink-0 text-xs border border-slate-800"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{p.userName}</p>
                    <p className="text-[10px] text-slate-500">
                      {p.isHost ? 'Créateur' : 'Participant'}
                    </p>
                  </div>
                </div>

                {isDual ? (
                  <div className="flex items-center gap-1">
                    <span className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold px-2 py-0.5 rounded">
                      BK {p.backValue !== undefined ? String(p.backValue) : '-'}
                    </span>
                    <span className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold px-2 py-0.5 rounded">
                      FR {p.frontValue !== undefined ? String(p.frontValue) : '-'}
                    </span>
                  </div>
                ) : (
                  <div className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-sm px-2.5 py-0.5 rounded-lg">
                    {p.value !== undefined ? String(p.value) : '-'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
