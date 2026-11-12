export type DeckType = 'fibonacci' | 'tshirt' | 'powers_of_2' | 'hours' | 'custom';

export type VoteValue = number | string;

export interface DeckPreset {
  id: DeckType;
  label: string;
  description: string;
  values: VoteValue[];
}

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  avatarSeed?: string;
  color?: string;
  icon?: string;
  isGoogleAuth?: boolean;
  isHost?: boolean;
  isSpectator?: boolean;
  hostToken?: string;
  socketId?: string;
}

export interface ParticipantVote {
  userId: string;
  userName: string;
  avatarUrl?: string;
  avatarSeed?: string;
  color?: string;
  icon?: string;
  isHost?: boolean;
  isGoogleAuth?: boolean;
  isSpectator?: boolean;
  isOffline?: boolean;
  socketId?: string;
  hasVoted: boolean;
  hasBackVoted?: boolean;
  hasFrontVoted?: boolean;
  votedAt?: number;
  value?: VoteValue;
  backValue?: VoteValue;
  frontValue?: VoteValue;
}

export interface HistoryItem {
  id: string;
  storyTitle: string;
  timestamp: string;
  durationSeconds?: number;
  firstVoterName?: string;
  firstVoterId?: string;
  timeToFirstVoteSeconds?: number;
  estimationMode?: 'GLOBAL' | 'DUAL';
  deckType?: DeckType;
  average: number | null;
  mode: VoteValue | null;
  finalScore?: VoteValue | null;
  backAverage?: number | null;
  backMode?: VoteValue | null;
  backFinalScore?: VoteValue | null;
  frontAverage?: number | null;
  frontMode?: VoteValue | null;
  frontFinalScore?: VoteValue | null;
  totalVotes: number;
  votes: {
    userId?: string;
    userName: string;
    votedAt?: number;
    value?: VoteValue;
    backValue?: VoteValue;
    frontValue?: VoteValue;
  }[];
}

export interface BacklogItem {
  id: string;
  title: string;
  description?: string;
  estimatedScore?: VoteValue | null;
  estimatedBackScore?: VoteValue | null;
  estimatedFrontScore?: VoteValue | null;
}

export interface RoomEmojiStats {
  totalCount: number;
  userCounts: Record<string, {
    userName: string;
    count: number;
    emojis: Record<string, number>;
  }>;
  topEmoji?: string;
}

export interface RoomState {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  hostToken?: string;
  hostGoogleUid?: string;
  deckType: DeckType;
  deckValues?: VoteValue[];
  currentStory: string;
  storyStartTime?: number;
  timerDuration?: number | null;
  timerRemaining?: number | null;
  isSessionStarted?: boolean;
  isRevealed: boolean;
  estimationMode?: 'GLOBAL' | 'DUAL';
  revealCountdown?: number | null;
  participants: Record<string, ParticipantVote>;
  history: HistoryItem[];
  backlog?: BacklogItem[];
  emojiStats?: RoomEmojiStats;
  createdTimestamp: number;
  lastActiveTimestamp?: number;
  lastUpdatedTimestamp?: number;
  expireAtMs?: number;
  kickedUserIds?: string[];
}

export interface EmojiEventPayload {
  id: string;
  emoji: string;
  senderName: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface CreatedRoomSummary {
  roomId: string;
  roomName: string;
  createdTimestamp: number;
  expireAtMs?: number;
  hostId: string;
  hostName: string;
  currentStory: string;
  history: HistoryItem[];
  backlog?: BacklogItem[];
  participantCount?: number;
}


