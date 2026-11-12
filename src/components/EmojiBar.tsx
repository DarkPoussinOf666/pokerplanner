import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Target, Plus, Search, Smile } from 'lucide-react';

interface EmojiBarProps {
  selectedEmoji: string | null;
  onSelectEmoji: (emoji: string | null) => void;
}

// User requested focus on these specific 6 emojis as default
const FEATURED_EMOJIS = [
  '❤️', // Cœur
  '🔨', // Marteau
  '💩', // Étron
  '🍆', // Aubergine
  '🗡️', // Dague
  '☄️'  // Comète
];

// Rich categorized emoji dataset for browser native support
const EMOJI_CATEGORIES = [
  {
    name: 'Incontournables',
    emojis: ['❤️', '🔨', '💩', '🍆', '🗡️', '☄️', '🚀', '🔥', '🎉', '🤡', '☕', '🍿', '💡', '💯', '🎯', '🍕', '👏', '😱', '👍', '👎']
  },
  {
    name: 'Visages & Réactions',
    emojis: Array.from(new Set(['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🥹', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😮‍💨', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫣', '🤗', '🫡', '🤔', '🤭', '🫢', '🤫', '🫠', '🤥', '😶', '🫥', '😐', '😑', '😬', '🫨', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃']))
  },
  {
    name: 'Gestes & Mains',
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾']
  },
  {
    name: 'Objets, Armes & Outils',
    emojis: ['🔨', '🗡️', '⚔️', '🛡️', '💣', '🔪', '🔫', '🪓', '⛏️', '🔧', '🪛', '🔩', '⚙️', '🧲', '🪄', '🔮', '🔑', '🗝️', '🔔', '📣', '💎', '💡', '🔦', '⏰', '⌛', '⏳', '📦', '🎁', '🎈', '🎉', '🎊', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎯', '🎮', '🎲', '🧩']
  },
  {
    name: 'Nature, Éléments & Espace',
    emojis: ['☄️', '🌟', '⭐', '✨', '⚡', '💥', '🔥', '🌈', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '🌩️', '🌩', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌙', '🌕', '🪐', '🌌', '🌍', '🌊', '🌋', '🌹', '🌻', '🌺', '🌸', '🌴', '🌲', '🍀', '🍁']
  },
  {
    name: 'Nourriture & Boissons',
    emojis: ['🍆', '🍕', '🍔', '🍟', '🌭', '🍿', '🥓', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '🥪', '🌮', '🌯', '🫔', '🥙', '🧆', '🍣', '🍱', '🍛', '🍜', '🍝', '🍠', '🍢', '🍡', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '🍼', '🥛', '☕', '🫖', '🍵', '🧃', '🥤', '🧋', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
  }
];

export const EmojiBar: React.FC<EmojiBarProps> = ({ selectedEmoji, onSelectEmoji }) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSelect = (emoji: string) => {
    onSelectEmoji(emoji);
    setIsPickerOpen(false);
    setInputError(null);
  };

  const handleCustomEmojiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError(null);
    const raw = customEmojiInput.trim();
    if (!raw) return;

    // Extract only emoji symbols from input
    const emojiMatches = raw.match(/\p{Extended_Pictographic}/gu);
    if (!emojiMatches || emojiMatches.length === 0) {
      setInputError("Seuls les émojis sont autorisés. Veuillez coller ou saisir un émoji.");
      return;
    }

    const cleanEmoji = emojiMatches.slice(0, 2).join('');
    handleSelect(cleanEmoji);
    setCustomEmojiInput('');
  };

  // Filter emojis based on search
  const filteredCategories = EMOJI_CATEGORIES.map(cat => ({
    ...cat,
    emojis: searchQuery
      ? cat.emojis.filter(e => e.includes(searchQuery))
      : cat.emojis
  })).filter(cat => cat.emojis.length > 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-2 my-2 relative z-50">
      <div className="bg-[#0F1218] border border-[#242933] rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl backdrop-blur-sm">
        
        {/* Active Emoji Status / Instructions */}
        <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
          {selectedEmoji ? (
            <div className="flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 px-3 py-1.5 rounded-xl animate-pulse">
              <Target className="w-4 h-4 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span>
                Émoji actif : <strong className="text-xl leading-none">{selectedEmoji}</strong>
              </span>
              <span className="text-slate-400 text-[11px] hidden md:inline ml-1">
                (Cliquez sur la table pour lancer)
              </span>
              <button
                onClick={() => onSelectEmoji(null)}
                className="ml-2 p-1 hover:bg-indigo-500/30 rounded-lg text-indigo-300 transition-colors"
                title="Désactiver l'émoji"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs px-2">
              <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>Choisis un émoji puis clique sur la table ou un joueur !</span>
            </div>
          )}
        </div>

        {/* Emojis Default List + Full Selector Button */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 px-1 w-full sm:w-auto justify-start sm:justify-end">
          {FEATURED_EMOJIS.map((emoji) => {
            const isSelected = selectedEmoji === emoji;
            return (
              <motion.button
                key={emoji}
                whileHover={{ scale: 1.25, rotate: 5 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => onSelectEmoji(isSelected ? null : emoji)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 border-2 border-indigo-300 shadow-lg shadow-indigo-500/50 scale-110 ring-2 ring-indigo-400'
                    : 'bg-[#1A1D23] hover:bg-[#242933] border border-[#303642] hover:border-slate-500'
                }`}
                title={isSelected ? `Désactiver ${emoji}` : `Activer ${emoji}`}
              >
                {emoji}
              </motion.button>
            );
          })}

          {/* Button to open full system/browser emoji picker modal */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setIsPickerOpen(true)}
            className="h-10 px-3 ml-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-full flex items-center gap-1.5 shadow-md shadow-indigo-900/40 border border-indigo-400/30 cursor-pointer shrink-0"
            title="Ouvrir tous les émojis"
          >
            <Smile className="w-4 h-4" />
            <span className="hidden sm:inline">Tous les émojis</span>
            <Plus className="w-3.5 h-3.5" />
          </motion.button>
        </div>

      </div>

      {/* Full Browser/System Emoji Selector Modal */}
      <AnimatePresence>
        {isPickerOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              className="bg-[#12151C] border border-[#2A303C] rounded-3xl p-5 w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#242933]">
                <div className="flex items-center gap-2">
                  <Smile className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Tous les émojis du navigateur</h3>
                </div>
                <button
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white bg-[#1C202B] hover:bg-[#252B3A] rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Input for custom typed emoji */}
              <div className="mt-4">
                <form onSubmit={handleCustomEmojiSubmit} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Colle un émoji (ex: 🦄, 🚀, 🌮)..."
                    value={customEmojiInput}
                    onChange={(e) => {
                      setCustomEmojiInput(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    className="flex-1 bg-[#0A0C10] border border-[#2A303C] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!customEmojiInput.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs rounded-xl transition-colors shrink-0 cursor-pointer"
                  >
                    Utiliser
                  </button>
                </form>
                {inputError && (
                  <p className="text-xs font-semibold text-rose-400 mt-1.5 ml-1 animate-pulse">
                    ⚠️ {inputError}
                  </p>
                )}
              </div>

              {/* Search input */}
              <div className="relative mt-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrer les émojis..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#181C26] border border-[#282E3B] focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none"
                />
              </div>

              {/* Categorized Emojis Scroll Area */}
              <div className="flex-1 overflow-y-auto mt-4 pr-1 space-y-4 custom-scrollbar max-h-[50vh]">
                {filteredCategories.map((cat) => (
                  <div key={cat.name} className="space-y-1.5">
                    <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider sticky top-0 bg-[#12151C]/95 py-1 backdrop-blur-sm z-10">
                      {cat.name}
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
                      {cat.emojis.map((emoji, idx) => (
                        <button
                          key={`${cat.name}-${emoji}-${idx}`}
                          onClick={() => handleSelect(emoji)}
                          className="w-10 h-10 text-2xl flex items-center justify-center rounded-xl bg-[#1A1E29] hover:bg-indigo-600/30 hover:scale-125 border border-[#262C3A] hover:border-indigo-400/50 transition-all cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredCategories.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Aucun émoji trouvé pour "{searchQuery}". Tu peux en coller un directement ci-dessus !
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="mt-3 pt-3 border-t border-[#242933] text-center text-[11px] text-slate-400">
                Astuce : Vous pouvez aussi copier-coller n'importe quel émoji depuis votre clavier système !
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
