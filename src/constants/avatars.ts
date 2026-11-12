import { DeckPreset, DeckType } from '../types';

export const DECK_PRESETS: Record<DeckType, DeckPreset> = {
  fibonacci: {
    id: 'fibonacci',
    label: 'Fibonacci Standard',
    description: '0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕',
    values: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕']
  },
  tshirt: {
    id: 'tshirt',
    label: 'T-Shirt Sizing',
    description: 'XS, S, M, L, XL, XXL, ?, ☕',
    values: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕']
  },
  powers_of_2: {
    id: 'powers_of_2',
    label: 'Puissances de 2',
    description: '0, 1, 2, 4, 8, 16, 32, 64, ?, ☕',
    values: [0, 1, 2, 4, 8, 16, 32, 64, '?', '☕']
  },
  hours: {
    id: 'hours',
    label: 'Heures & Jours',
    description: '0.5h, 1h, 2h, 4h, 8h (1j), 16h (2j), 24h (3j), 40h (1sem), ?, ☕',
    values: ['0.5', '1', '2', '4', '8', '16', '24', '40', '?', '☕']
  },
  custom: {
    id: 'custom',
    label: 'Échelle Personnalisée',
    description: 'Cartes configurées sur-mesure pour votre équipe',
    values: [0, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕']
  }
};

export const FUNNY_NAMES = [
  "Lama Fringant", "Poulpe Zen", "Panda Agile", 
  "Castor Tech", "T-Rex Agile", "Loutre Scrum",
  "Pingouin Express", "Koala Serein", "Hibou Sage",
  "Tigre Végétal", "Renard Rusé", "Faucon Rapide",
  "Marmotte Dev", "Chaton Malin", "Dauphin Calme",
  "Tortue Sprint", "Caméléon Pro", "Lynx Vigilant"
];

export interface SvgAvatarConfig {
  seed: string;
  palette: string; // gradient identifier
  shapeType: number; // 0 to 7
  glyphType: number; // 0 to 7
}

export const AVATAR_PALETTES = [
  { id: 'indigo', name: 'Indigo Minéral', from: '#4F46E5', to: '#06B6D4', bg: '#1E1B4B' },
  { id: 'emerald', name: 'Émeraude Zen', from: '#059669', to: '#10B981', bg: '#064E3B' },
  { id: 'violet', name: 'Violet Profond', from: '#7C3AED', to: '#C084FC', bg: '#2E1065' },
  { id: 'amber', name: 'Ambre Chaud', from: '#D97706', to: '#FBBF24', bg: '#451A03' },
  { id: 'rose', name: 'Rose Poudré', from: '#E11D48', to: '#FB7185', bg: '#4C0519' },
  { id: 'cyan', name: 'Cyan Polaire', from: '#0891B2', to: '#38BDF8', bg: '#083344' },
  { id: 'slate', name: 'Ardoise Pure', from: '#475569', to: '#94A3B8', bg: '#0F172A' },
  { id: 'teal', name: 'Lagon Épuré', from: '#0D9488', to: '#2DD4BF', bg: '#134E4A' }
];

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generateRandomAvatar(nameCandidate?: string): { name: string; avatarSeed: string } {
  const name = nameCandidate || FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)];
  const seed = `${name}-${Math.random().toString(36).substring(2, 9)}`;
  return { name, avatarSeed: seed };
}
