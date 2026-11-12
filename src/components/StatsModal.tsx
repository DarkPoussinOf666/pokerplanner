import React, { useState, useMemo } from 'react';
import { HistoryItem, RoomEmojiStats, RoomState, VoteValue } from '../types';
import {
  X,
  BarChart3,
  Zap,
  Target,
  Rocket,
  Shield,
  Coffee,
  HelpCircle,
  Clock,
  CheckCircle2,
  Trophy,
  PieChart as PieChartIcon,
  TrendingUp,
  Award,
  Sparkles,
  Smile,
  Flame,
  Copy,
  Check,
  Layers,
  Users,
  FileText,
  Crown,
  Percent,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  Legend
} from 'recharts';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  roomState?: RoomState | null;
  emojiStats?: RoomEmojiStats;
}

interface ParticipantMetric {
  userName: string;
  totalVotes: number;
  totalNumericVotes: number;
  totalAbsoluteDiff: number;
  totalSignedDiff: number;
  avgAbsDiff: number;
  avgSignedDiff: number;
  coffeeCount: number;
  questionCount: number;
  perfectMatchesCount: number;
  firstVoterCount: number;
  emojisSent: number;
  topEmoji?: string;
}

export const StatsModal: React.FC<StatsModalProps> = ({
  isOpen,
  onClose,
  history,
  roomState,
  emojiStats: propEmojiStats
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'points' | 'emojis' | 'participants'>('overview');
  const [copiedSummary, setCopiedSummary] = useState(false);

  const emojiStats = propEmojiStats || roomState?.emojiStats;

  // Compute all metrics
  const stats = useMemo(() => {
    let totalStoryPoints = 0;
    let totalBackStoryPoints = 0;
    let totalFrontStoryPoints = 0;
    let hasDualItems = false;
    let totalDurationSecs = 0;
    let perfectConsensusCount = 0;

    const firstVotersMap: Record<string, number> = {};
    const participantMap: Record<string, ParticipantMetric> = {};

    let mostDebatedStory: { title: string; spread: number; duration: number } | null = null;

    history.forEach(item => {
      const isDual = item.estimationMode === 'DUAL';
      if (isDual) hasDualItems = true;

      // First voter tracking from history item
      if (item.firstVoterName) {
        firstVotersMap[item.firstVoterName] = (firstVotersMap[item.firstVoterName] || 0) + 1;
      }

      // Final score calculation
      let storyFinalScore: number | null = null;
      let bScore: number | null = null;
      let fScore: number | null = null;

      if (isDual) {
        bScore = typeof item.backFinalScore === 'number'
          ? item.backFinalScore
          : (typeof item.backMode === 'number' ? item.backMode : (typeof item.backAverage === 'number' ? Math.round(item.backAverage) : null));
        fScore = typeof item.frontFinalScore === 'number'
          ? item.frontFinalScore
          : (typeof item.frontMode === 'number' ? item.frontMode : (typeof item.frontAverage === 'number' ? Math.round(item.frontAverage) : null));

        if (bScore !== null) totalBackStoryPoints += bScore;
        if (fScore !== null) totalFrontStoryPoints += fScore;

        if (typeof item.finalScore === 'number') {
          storyFinalScore = item.finalScore;
        } else if (bScore !== null || fScore !== null) {
          storyFinalScore = (bScore || 0) + (fScore || 0);
        }
      } else {
        if (typeof item.finalScore === 'number') {
          storyFinalScore = item.finalScore;
        } else if (typeof item.mode === 'number') {
          storyFinalScore = item.mode;
        } else if (typeof item.average === 'number') {
          storyFinalScore = Math.round(item.average);
        }
      }

      if (storyFinalScore !== null) {
        totalStoryPoints += storyFinalScore;
      }

      if (item.durationSeconds) {
        totalDurationSecs += item.durationSeconds;
      }

      // Check consensus & compute spread
      const numericVotes: number[] = [];
      item.votes.forEach(v => {
        if (isDual) {
          if (typeof v.backValue === 'number') numericVotes.push(v.backValue);
          if (typeof v.frontValue === 'number') numericVotes.push(v.frontValue);
        } else {
          if (typeof v.value === 'number') numericVotes.push(v.value);
        }
      });

      if (numericVotes.length > 1) {
        const spread = Math.max(...numericVotes) - Math.min(...numericVotes);
        if (!mostDebatedStory || spread > mostDebatedStory.spread || (spread === mostDebatedStory.spread && (item.durationSeconds || 0) > mostDebatedStory.duration)) {
          mostDebatedStory = {
            title: item.storyTitle,
            spread,
            duration: item.durationSeconds || 0
          };
        }
      }

      if (isDual) {
        const backNums = item.votes.map(v => v.backValue).filter((v): v is number => typeof v === 'number');
        const frontNums = item.votes.map(v => v.frontValue).filter((v): v is number => typeof v === 'number');
        if (backNums.length > 0 && backNums.every(v => v === backNums[0]) && frontNums.length > 0 && frontNums.every(v => v === frontNums[0])) {
          perfectConsensusCount++;
        }
      } else {
        const globalNums = item.votes.map(v => v.value).filter((v): v is number => typeof v === 'number');
        if (globalNums.length > 0 && globalNums.every(v => v === globalNums[0])) {
          perfectConsensusCount++;
        }
      }

      // Process participant votes
      item.votes.forEach(v => {
        const name = v.userName || 'Anonyme';
        if (!participantMap[name]) {
          participantMap[name] = {
            userName: name,
            totalVotes: 0,
            totalNumericVotes: 0,
            totalAbsoluteDiff: 0,
            totalSignedDiff: 0,
            avgAbsDiff: 0,
            avgSignedDiff: 0,
            coffeeCount: 0,
            questionCount: 0,
            perfectMatchesCount: 0,
            firstVoterCount: 0,
            emojisSent: 0
          };
        }

        const pStat = participantMap[name];
        pStat.totalVotes++;

        if (v.value === '☕' || v.backValue === '☕' || v.frontValue === '☕') {
          pStat.coffeeCount++;
        }
        if (v.value === '?' || v.backValue === '?' || v.frontValue === '?') {
          pStat.questionCount++;
        }

        if (isDual) {
          const targetBack = bScore;
          if (typeof v.backValue === 'number' && typeof targetBack === 'number') {
            const diff = v.backValue - targetBack;
            pStat.totalNumericVotes++;
            pStat.totalAbsoluteDiff += Math.abs(diff);
            pStat.totalSignedDiff += diff;
            if (v.backValue === targetBack) pStat.perfectMatchesCount++;
          }

          const targetFront = fScore;
          if (typeof v.frontValue === 'number' && typeof targetFront === 'number') {
            const diff = v.frontValue - targetFront;
            pStat.totalNumericVotes++;
            pStat.totalAbsoluteDiff += Math.abs(diff);
            pStat.totalSignedDiff += diff;
            if (v.frontValue === targetFront) pStat.perfectMatchesCount++;
          }
        } else {
          if (typeof v.value === 'number' && typeof storyFinalScore === 'number') {
            const diff = v.value - storyFinalScore;
            pStat.totalNumericVotes++;
            pStat.totalAbsoluteDiff += Math.abs(diff);
            pStat.totalSignedDiff += diff;
            if (v.value === storyFinalScore) pStat.perfectMatchesCount++;
          }
        }
      });
    });

    // Merge first voters counts
    Object.entries(firstVotersMap).forEach(([name, count]) => {
      if (participantMap[name]) {
        participantMap[name].firstVoterCount = count;
      }
    });

    // Merge emoji counts from roomEmojiStats
    if (emojiStats?.userCounts) {
      const userList = Object.values(emojiStats.userCounts) as Array<{
        userName: string;
        count: number;
        emojis?: Record<string, number>;
      }>;

      userList.forEach(u => {
        const name = u.userName;
        let p = participantMap[name];
        if (!p) {
          p = {
            userName: name,
            totalVotes: 0,
            totalNumericVotes: 0,
            totalAbsoluteDiff: 0,
            totalSignedDiff: 0,
            avgAbsDiff: 0,
            avgSignedDiff: 0,
            coffeeCount: 0,
            questionCount: 0,
            perfectMatchesCount: 0,
            firstVoterCount: 0,
            emojisSent: 0
          };
          participantMap[name] = p;
        }
        p.emojisSent = u.count;
        if (u.emojis) {
          let topE = '';
          let topC = 0;
          Object.entries(u.emojis).forEach(([em, c]) => {
            const countNum = Number(c);
            if (countNum > topC) {
              topC = countNum;
              topE = em;
            }
          });
          p.topEmoji = topE;
        }
      });
    }

    // Compute averages
    const participants = Object.values(participantMap).map(p => ({
      ...p,
      avgAbsDiff: p.totalNumericVotes > 0 ? Math.round((p.totalAbsoluteDiff / p.totalNumericVotes) * 10) / 10 : 0,
      avgSignedDiff: p.totalNumericVotes > 0 ? Math.round((p.totalSignedDiff / p.totalNumericVotes) * 10) / 10 : 0
    }));

    const validParticipants = participants.filter(p => p.totalNumericVotes > 0);

    // Fun Awards:
    // 1. Flash Voter (Lucky Luke)
    const flashVoters = [...participants].filter(p => p.firstVoterCount > 0).sort((a, b) => b.firstVoterCount - a.firstVoterCount);
    const flashVoter = flashVoters.length > 0 ? flashVoters[0] : null;

    // 2. Consensus Sniper
    const sniper = validParticipants.length > 0
      ? [...validParticipants].sort((a, b) => a.avgAbsDiff - b.avgAbsDiff || b.perfectMatchesCount - a.perfectMatchesCount)[0]
      : null;

    // 3. Optimist (TGV)
    const optimist = validParticipants.length > 0
      ? [...validParticipants].sort((a, b) => a.avgSignedDiff - b.avgSignedDiff)[0]
      : null;

    // 4. Prudent (Safety First)
    const prudent = validParticipants.length > 0
      ? [...validParticipants].sort((a, b) => b.avgSignedDiff - a.avgSignedDiff)[0]
      : null;

    // 5. Coffee Master
    const coffeeKing = [...participants].filter(p => p.coffeeCount > 0).sort((a, b) => b.coffeeCount - a.coffeeCount)[0] || null;

    // 6. Question / Spec Seeker
    const questionKing = [...participants].filter(p => p.questionCount > 0).sort((a, b) => b.questionCount - a.questionCount)[0] || null;

    // 7. Emoji Artificier
    const emojiKing = [...participants].filter(p => p.emojisSent > 0).sort((a, b) => b.emojisSent - a.emojisSent)[0] || null;

    // Back vs Front Ratio
    const combinedDualSP = totalBackStoryPoints + totalFrontStoryPoints;
    const backRatio = combinedDualSP > 0 ? Math.round((totalBackStoryPoints / combinedDualSP) * 100) : 50;
    const frontRatio = combinedDualSP > 0 ? 100 - backRatio : 50;

    // Complexity distribution buckets
    const spBuckets: Record<string, { total: number; back: number; front: number }> = {};
    history.forEach(item => {
      if (item.estimationMode === 'DUAL') {
        const b = typeof item.backFinalScore === 'number' ? String(item.backFinalScore) : null;
        const f = typeof item.frontFinalScore === 'number' ? String(item.frontFinalScore) : null;
        if (b) {
          if (!spBuckets[b]) spBuckets[b] = { total: 0, back: 0, front: 0 };
          spBuckets[b].back++;
        }
        if (f) {
          if (!spBuckets[f]) spBuckets[f] = { total: 0, back: 0, front: 0 };
          spBuckets[f].front++;
        }
        const tot = typeof item.finalScore === 'number'
          ? String(item.finalScore)
          : (b && f ? String(Number(b) + Number(f)) : null);
        if (tot) {
          if (!spBuckets[tot]) spBuckets[tot] = { total: 0, back: 0, front: 0 };
          spBuckets[tot].total++;
        }
      } else {
        const val = typeof item.finalScore === 'number'
          ? String(item.finalScore)
          : (typeof item.mode === 'number' ? String(item.mode) : (typeof item.average === 'number' ? String(Math.round(item.average)) : 'N/A'));
        if (!spBuckets[val]) spBuckets[val] = { total: 0, back: 0, front: 0 };
        spBuckets[val].total++;
      }
    });

    const spChartData = Object.entries(spBuckets).map(([score, counts]) => ({
      score: `${score} SP`,
      rawScore: parseFloat(score) || 0,
      total: counts.total,
      back: counts.back,
      front: counts.front
    })).sort((a, b) => a.rawScore - b.rawScore);

    const avgDurationPerUS = history.length > 0 ? Math.round(totalDurationSecs / history.length) : 0;
    const avgDurationPerSP = totalStoryPoints > 0 ? Math.round(totalDurationSecs / totalStoryPoints) : 0;

    return {
      totalStoryPoints,
      totalBackStoryPoints,
      totalFrontStoryPoints,
      hasDualItems,
      totalDurationSecs,
      avgDurationPerUS,
      avgDurationPerSP,
      perfectConsensusCount,
      consensusRate: history.length > 0 ? Math.round((perfectConsensusCount / history.length) * 100) : 0,
      participants,
      validParticipants,
      flashVoter,
      sniper,
      optimist,
      prudent,
      coffeeKing,
      questionKing,
      emojiKing,
      mostDebatedStory,
      backRatio,
      frontRatio,
      combinedDualSP,
      spChartData,
      totalEmojis: emojiStats?.totalCount || 0,
      topEmoji: emojiStats?.topEmoji || '🎉',
      emojiUsers: emojiStats?.userCounts
        ? (Object.values(emojiStats.userCounts) as Array<{ userName: string; count: number; emojis?: Record<string, number> }>).sort((a, b) => b.count - a.count)
        : []
    };
  }, [history, emojiStats]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    const lines = [
      `📊 **Bilan Scrum Poker Express - Salle ${roomState?.name || roomState?.id || ''}**`,
      `---`,
      `🎯 **Total Story Points:** ${stats.totalStoryPoints} SP (${history.length} US estimées)`,
      stats.hasDualItems ? `⚙️ **Répartition:** Back-End ${stats.totalBackStoryPoints} SP (${stats.backRatio}%) | Front-End ${stats.totalFrontStoryPoints} SP (${stats.frontRatio}%)` : '',
      `⏱️ **Temps moyen / US:** ${Math.floor(stats.avgDurationPerUS / 60)}m ${stats.avgDurationPerUS % 60}s | Taux d'unanimité: ${stats.consensusRate}% (${stats.perfectConsensusCount} US)`,
      stats.totalEmojis > 0 ? `🎉 **Ambiance:** ${stats.totalEmojis} émojis lancés (Top: ${stats.topEmoji})` : '',
      ``,
      `🏆 **Palmarès & Trophées:**`,
      stats.flashVoter ? `• ⚡ Votant Flash (Lucky Luke): ${stats.flashVoter.userName} (1er à voter ${stats.flashVoter.firstVoterCount} fois)` : '',
      stats.sniper ? `• 🎯 Sniper du Consensus: ${stats.sniper.userName} (Écart moyen: ±${stats.sniper.avgAbsDiff} SP)` : '',
      stats.optimist && stats.optimist.avgSignedDiff < -0.2 ? `• 🚀 L'Optimiste / TGV: ${stats.optimist.userName} (Sous-estime de ${Math.abs(stats.optimist.avgSignedDiff)} SP)` : '',
      stats.prudent && stats.prudent.avgSignedDiff > 0.2 ? `• 🛡️ Le Gardien Prudent: ${stats.prudent.userName} (+${stats.prudent.avgSignedDiff} SP de sécurité)` : '',
      stats.emojiKing ? `• 🎭 L'Artificier d'Émojis: ${stats.emojiKing.userName} (${stats.emojiKing.emojisSent} envoyés)` : '',
      stats.mostDebatedStory ? `• 🌪️ US la plus Débattue: "${stats.mostDebatedStory.title}" (Écart max: ${stats.mostDebatedStory.spread} SP)` : ''
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#10141D] border border-slate-800 text-slate-100 w-full max-w-4xl max-h-[92vh] rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Subtle decorative background gradient circles */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-tight truncate">
                  Statistiques & Rétro de Chiffrage
                </h3>
                <span className="hidden sm:inline-block text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  Live
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Palmarès, vitesse de vote, répartition Back/Front et ambiance
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {history.length > 0 && (
              <button
                type="button"
                onClick={handleCopySummary}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Copier le bilan complet pour Slack / Teams / Rétro"
              >
                {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
                <span className="hidden md:inline">{copiedSummary ? 'Copié !' : 'Copier le bilan'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 my-3 border-b border-slate-800/80 pb-2.5 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Trophées & Vue d'Ensemble</span>
          </button>

          <button
            onClick={() => setActiveTab('points')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'points'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Points & Back vs Front</span>
          </button>

          <button
            onClick={() => setActiveTab('emojis')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'emojis'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Émojis & Ambiance</span>
            {stats.totalEmojis > 0 && (
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {stats.totalEmojis}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('participants')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'participants'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Détail Membres ({stats.participants.length})</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 custom-scrollbar">
          {history.length === 0 && stats.totalEmojis === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30 text-indigo-400" />
              <p className="text-base font-bold text-slate-300">Aucun tour de vote enregistré</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Lancez un vote et dévoilez les cartes pour découvrir les statistiques de vitesse, la répartition Back/Front et le palmarès de l'équipe !
              </p>
            </div>
          ) : (
            <>
              {/* Summary KPIs Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-[#131722] border border-slate-800 rounded-2xl p-3 text-center flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Story Points</span>
                  <div className="text-2xl font-black text-indigo-400 mt-0.5 tracking-tight">{stats.totalStoryPoints} SP</div>
                  <span className="text-[10px] text-slate-500 truncate">
                    {stats.hasDualItems ? `BK: ${stats.totalBackStoryPoints} | FR: ${stats.totalFrontStoryPoints}` : `${history.length} US estimées`}
                  </span>
                </div>

                <div className="bg-[#131722] border border-slate-800 rounded-2xl p-3 text-center flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Taux d'Unanimité</span>
                  <div className="text-2xl font-black text-emerald-400 mt-0.5 tracking-tight">{stats.consensusRate}%</div>
                  <span className="text-[10px] text-slate-500">{stats.perfectConsensusCount} US sans écart</span>
                </div>

                <div className="bg-[#131722] border border-slate-800 rounded-2xl p-3 text-center flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Temps Moyen / US</span>
                  <div className="text-2xl font-black text-amber-400 mt-0.5 tracking-tight">
                    {Math.floor(stats.avgDurationPerUS / 60)}m {stats.avgDurationPerUS % 60}s
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {stats.avgDurationPerSP > 0 ? `~${stats.avgDurationPerSP}s / Story Point` : 'Débat fluide'}
                  </span>
                </div>

                <div className="bg-[#131722] border border-slate-800 rounded-2xl p-3 text-center flex flex-col justify-center">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Émojis Lancés</span>
                  <div className="text-2xl font-black text-fuchsia-400 mt-0.5 tracking-tight flex items-center justify-center gap-1.5">
                    <span>{stats.totalEmojis}</span>
                    <span className="text-lg">{stats.topEmoji}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Ambiance de session</span>
                </div>
              </div>

              {/* TAB 1: OVERVIEW & PALMARÈS */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-indigo-400" /> Palmarès & Trophées de l'Équipe
                    </h4>
                    <span className="text-[10px] text-slate-500">Calculé en temps réel</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Lucky Luke - First to Vote */}
                    {stats.flashVoter && (
                      <div className="bg-[#131722] border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3 relative overflow-hidden">
                        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl shrink-0">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                            <span>Le Votant Flash (Lucky Luke)</span>
                            <span className="text-xs">⚡</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">{stats.flashVoter.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            A été le <strong className="text-amber-300">premier à voter {stats.flashVoter.firstVoterCount} fois</strong> ! Dégaine plus vite que son ombre.
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">
                            Réactivité maximale
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Consensus Sniper */}
                    {stats.sniper && (
                      <div className="bg-[#131722] border border-emerald-500/20 rounded-2xl p-3.5 flex items-start gap-3 relative overflow-hidden">
                        <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl shrink-0">
                          <Target className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <span>Le Sniper du Consensus</span>
                            <span className="text-xs">🎯</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">{stats.sniper.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Écart moyen de seulement <strong className="text-emerald-300">±{stats.sniper.avgAbsDiff} SP</strong> avec le score final retenu.
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold">
                            {stats.sniper.perfectMatchesCount} votes pile dans le mille
                          </span>
                        </div>
                      </div>
                    )}

                    {/* The Optimist */}
                    {stats.optimist && stats.optimist.avgSignedDiff < -0.2 && (
                      <div className="bg-[#131722] border border-blue-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl shrink-0">
                          <Rocket className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <span>L'Optimiste / TGV</span>
                            <span className="text-xs">🚀</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">{stats.optimist.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Vote en moyenne <strong className="text-blue-300">{Math.abs(stats.optimist.avgSignedDiff)} SP plus bas</strong> que le groupe.
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded font-semibold">
                            Chiffre vite, fonce vers la prod
                          </span>
                        </div>
                      </div>
                    )}

                    {/* The Prudent */}
                    {stats.prudent && stats.prudent.avgSignedDiff > 0.2 && (
                      <div className="bg-[#131722] border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                            <span>Le Gardien Prudent</span>
                            <span className="text-xs">🛡️</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">{stats.prudent.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Ajoute <strong className="text-indigo-300">+{stats.prudent.avgSignedDiff} SP</strong> de sécurité pour amortir les imprévus.
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded font-semibold">
                            Sécurise le sprint
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Emoji Artificier */}
                    {stats.emojiKing && stats.emojiKing.emojisSent > 0 && (
                      <div className="bg-[#131722] border border-fuchsia-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 rounded-xl shrink-0">
                          <Smile className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-wider flex items-center gap-1">
                            <span>L'Artificier d'Émojis</span>
                            <span className="text-xs">🎭</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">{stats.emojiKing.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            A lancé <strong className="text-fuchsia-300">{stats.emojiKing.emojisSent} émojis</strong> à travers la salle {stats.emojiKing.topEmoji ? `(fan de ${stats.emojiKing.topEmoji})` : ''}.
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 px-2 py-0.5 rounded font-semibold">
                            Ambianceur officiel
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Most Debated Story */}
                    {stats.mostDebatedStory && stats.mostDebatedStory.spread > 0 && (
                      <div className="bg-[#131722] border border-rose-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl shrink-0">
                          <Flame className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                            <span>L'Ouragan du Débat</span>
                            <span className="text-xs">🌪️</span>
                          </div>
                          <div className="text-base font-bold text-white truncate">"{stats.mostDebatedStory.title}"</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            Écart maximal de <strong className="text-rose-300">{stats.mostDebatedStory.spread} SP</strong> entre votants ({stats.mostDebatedStory.duration}s de débat).
                          </p>
                          <span className="inline-block mt-1.5 text-[9px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-2 py-0.5 rounded font-semibold">
                            Discussion intense
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Coffee Barista */}
                    {stats.coffeeKing && stats.coffeeKing.coffeeCount > 0 && (
                      <div className="bg-[#131722] border border-amber-500/20 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl shrink-0">
                          <Coffee className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Barista de l'Équipe</div>
                          <div className="text-base font-bold text-white truncate">{stats.coffeeKing.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            A demandé une pause café ☕ <strong className="text-amber-300">{stats.coffeeKing.coffeeCount} fois</strong> pendant la session.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Spec Seeker */}
                    {stats.questionKing && stats.questionKing.questionCount > 0 && (
                      <div className="bg-[#131722] border border-slate-700 rounded-2xl p-3.5 flex items-start gap-3">
                        <div className="p-2.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl shrink-0">
                          <HelpCircle className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Le Grand Inquisiteur</div>
                          <div className="text-base font-bold text-white truncate">{stats.questionKing.userName}</div>
                          <p className="text-xs text-slate-300 mt-0.5">
                            A voté <strong className="text-slate-200">{stats.questionKing.questionCount} fois '?'</strong> pour réclamer des critères d'acceptation.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: STORY POINTS & BACK VS FRONT */}
              {activeTab === 'points' && (
                <div className="space-y-5">
                  {/* Back vs Front SVG Visual Splitter */}
                  {stats.hasDualItems && stats.combinedDualSP > 0 && (
                    <div className="bg-[#131722] border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-400" />
                          Répartition Back-End vs Front-End
                        </h4>
                        <span className="text-xs font-semibold text-slate-400">
                          Total Dual : <strong className="text-white">{stats.combinedDualSP} SP</strong>
                        </span>
                      </div>

                      {/* Custom SVG Dual Proportion Bar */}
                      <div className="relative py-2">
                        <svg className="w-full h-8" viewBox="0 0 100 8" preserveAspectRatio="none">
                          {/* Back rect */}
                          <rect
                            x="0"
                            y="0"
                            width={stats.backRatio}
                            height="8"
                            rx="4"
                            className="fill-indigo-500 transition-all duration-500"
                          />
                          {/* Front rect */}
                          <rect
                            x={stats.backRatio}
                            y="0"
                            width={stats.frontRatio}
                            height="8"
                            rx="4"
                            className="fill-emerald-500 transition-all duration-500"
                          />
                        </svg>

                        <div className="flex items-center justify-between text-xs font-bold mt-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span className="text-slate-300">Back-End : <strong className="text-indigo-300">{stats.totalBackStoryPoints} SP</strong> ({stats.backRatio}%)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-slate-300">Front-End : <strong className="text-emerald-300">{stats.totalFrontStoryPoints} SP</strong> ({stats.frontRatio}%)</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 mt-2">
                        {stats.backRatio > 60
                          ? '⚡ Session à forte dominante Back-End (API, architecture, modèles).'
                          : stats.frontRatio > 60
                          ? '🎨 Session à forte dominante Front-End (UI/UX, intégration, composants).'
                          : '⚖️ Équilibre sain entre développement Back-End et Front-End.'}
                      </p>
                    </div>
                  )}

                  {/* Histogram of Complexity Distribution */}
                  <div className="bg-[#131722] border border-slate-800 rounded-2xl p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                      <PieChartIcon className="w-4 h-4 text-indigo-400" />
                      Distribution des Estimations par Palier (SP)
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-3">
                      Volume des User Stories par taille de complexité
                    </p>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.spChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                          <XAxis dataKey="score" stroke="#64748B" fontSize={11} tickLine={false} />
                          <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0E1219', borderColor: '#334155', borderRadius: '10px', color: '#fff', fontSize: '12px' }}
                          />
                          {stats.hasDualItems ? (
                            <>
                              <Bar dataKey="total" name="Total US" fill="#6366F1" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="back" name="Back-End" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="front" name="Front-End" fill="#34D399" radius={[4, 4, 0, 0]} />
                              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                            </>
                          ) : (
                            <Bar dataKey="total" name="User Stories" fill="#6366F1" radius={[6, 6, 0, 0]} />
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: EMOJIS & AMBIANCE */}
              {activeTab === 'emojis' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Smile className="w-4 h-4 text-fuchsia-400" /> Ambiance & Statistiques d'Émojis
                    </h4>
                    <span className="text-xs font-semibold text-slate-400">
                      Total : <strong className="text-fuchsia-300">{stats.totalEmojis}</strong> émojis
                    </span>
                  </div>

                  {stats.totalEmojis === 0 ? (
                    <div className="bg-[#131722] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                      <Smile className="w-10 h-10 mx-auto text-fuchsia-400/40 mb-2" />
                      <p className="font-semibold text-white text-sm">Aucun émoji envoyé pour l'instant</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Utilisez la barre d'émojis en bas pour lancer des réactions sur la table en direct !
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Emoji Podium SVG */}
                      {stats.emojiUsers.length >= 1 && (
                        <div className="bg-[#131722] border border-slate-800 rounded-2xl p-4">
                          <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">
                            Podium des Ambianceurs
                          </h5>

                          <div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
                            {/* 2nd place */}
                            {stats.emojiUsers[1] && (
                              <div className="flex flex-col items-center flex-1 max-w-[120px]">
                                <div className="text-xl mb-1">{stats.emojiUsers[1].emojis ? Object.keys(stats.emojiUsers[1].emojis)[0] || '🥈' : '🥈'}</div>
                                <span className="text-xs font-bold text-slate-200 truncate w-full text-center">{stats.emojiUsers[1].userName}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{stats.emojiUsers[1].count} émojis</span>
                                <div className="w-full bg-slate-800 border-t-2 border-slate-400 rounded-t-xl h-16 flex items-center justify-center text-slate-300 font-black text-sm mt-2 shadow-inner">
                                  2
                                </div>
                              </div>
                            )}

                            {/* 1st place */}
                            {stats.emojiUsers[0] && (
                              <div className="flex flex-col items-center flex-1 max-w-[140px]">
                                <Crown className="w-5 h-5 text-amber-400 mb-0.5 animate-bounce" />
                                <div className="text-3xl mb-1">{stats.topEmoji || '🥇'}</div>
                                <span className="text-sm font-extrabold text-white truncate w-full text-center">{stats.emojiUsers[0].userName}</span>
                                <span className="text-xs text-amber-300 font-bold">{stats.emojiUsers[0].count} émojis</span>
                                <div className="w-full bg-indigo-950 border-t-2 border-amber-400 rounded-t-xl h-24 flex items-center justify-center text-amber-300 font-black text-lg mt-2 shadow-inner">
                                  1
                                </div>
                              </div>
                            )}

                            {/* 3rd place */}
                            {stats.emojiUsers[2] && (
                              <div className="flex flex-col items-center flex-1 max-w-[120px]">
                                <div className="text-xl mb-1">{stats.emojiUsers[2].emojis ? Object.keys(stats.emojiUsers[2].emojis)[0] || '🥉' : '🥉'}</div>
                                <span className="text-xs font-bold text-slate-200 truncate w-full text-center">{stats.emojiUsers[2].userName}</span>
                                <span className="text-[10px] text-slate-400 font-semibold">{stats.emojiUsers[2].count} émojis</span>
                                <div className="w-full bg-slate-900 border-t-2 border-amber-700 rounded-t-xl h-12 flex items-center justify-center text-amber-600 font-black text-sm mt-2 shadow-inner">
                                  3
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Detailed Emoji table */}
                      <div className="bg-[#131722] border border-slate-800 rounded-2xl p-4">
                        <h5 className="text-xs font-bold text-white mb-3">
                          Détail des lancers par participant
                        </h5>
                        <div className="space-y-2">
                          {stats.emojiUsers.map(u => {
                            const pct = stats.totalEmojis > 0 ? Math.round((u.count / stats.totalEmojis) * 100) : 0;
                            return (
                              <div key={u.userName} className="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-semibold text-white truncate max-w-[140px]">{u.userName}</span>
                                  <div className="flex items-center gap-1">
                                    {u.emojis && Object.entries(u.emojis).map(([em, cnt]) => (
                                      <span key={em} className="bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800 text-[10px]" title={`${cnt} fois`}>
                                        {em} <strong className="text-slate-300 font-mono">{cnt}</strong>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="font-bold text-fuchsia-300">{u.count} ({pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: PARTICIPANTS DETAILS */}
              {activeTab === 'participants' && (
                <div className="bg-[#131722] border border-slate-800 rounded-2xl p-4 overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-400" />
                      Tableau Comparatif des Membres
                    </h4>
                    <span className="text-[11px] text-slate-500">{stats.participants.length} participants actifs</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                          <th className="pb-2.5">Participant</th>
                          <th className="pb-2.5 text-center">Votes</th>
                          <th className="pb-2.5 text-center">⚡ 1er à Voter</th>
                          <th className="pb-2.5 text-center">Écart Moyen</th>
                          <th className="pb-2.5 text-center">Biais Moyen</th>
                          <th className="pb-2.5 text-center">Émojis</th>
                          <th className="pb-2.5 text-right">Profil</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200 font-medium">
                        {stats.participants.map(p => (
                          <tr key={p.userName} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                              <span>{p.userName}</span>
                              {p.firstVoterCount > 0 && (
                                <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded font-semibold">
                                  ⚡ x{p.firstVoterCount}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 text-center text-slate-300">{p.totalVotes}</td>
                            <td className="py-2.5 text-center font-bold text-amber-400">
                              {p.firstVoterCount > 0 ? `${p.firstVoterCount} US` : '-'}
                            </td>
                            <td className="py-2.5 text-center font-bold text-indigo-300">
                              {p.totalNumericVotes > 0 ? `±${p.avgAbsDiff} SP` : '-'}
                            </td>
                            <td className={`py-2.5 text-center font-bold ${
                              p.avgSignedDiff > 0.2 ? 'text-indigo-400' : p.avgSignedDiff < -0.2 ? 'text-blue-400' : 'text-emerald-400'
                            }`}>
                              {p.totalNumericVotes > 0 ? `${p.avgSignedDiff > 0 ? '+' : ''}${p.avgSignedDiff} SP` : '-'}
                            </td>
                            <td className="py-2.5 text-center font-medium text-fuchsia-300">
                              {p.emojisSent > 0 ? `${p.emojisSent} ${p.topEmoji || '🎉'}` : '-'}
                            </td>
                            <td className="py-2.5 text-right">
                              {p.avgAbsDiff <= 0.4 && p.totalNumericVotes > 0 ? (
                                <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  🎯 Aligné
                                </span>
                              ) : p.avgSignedDiff < -0.4 ? (
                                <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  🚀 Optimiste
                                </span>
                              ) : p.avgSignedDiff > 0.4 ? (
                                <span className="bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  🛡️ Prudent
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                                  👍 Standard
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
