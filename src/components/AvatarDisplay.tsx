import React, { useMemo } from 'react';
import { AVATAR_PALETTES, hashString } from '../constants/avatars';

interface AvatarDisplayProps {
  user: {
    userName?: string;
    name?: string;
    avatarUrl?: string;
    avatarSeed?: string;
    color?: string;
    icon?: string;
    isSpectator?: boolean;
    isHost?: boolean;
  };
  className?: string;
  size?: number;
}

export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({ 
  user, 
  className = "", 
  size = 40 
}) => {
  const name = user.userName || user.name || "Joueur";
  const seedString = user.avatarSeed || user.avatarUrl || name;
  
  const avatarData = useMemo(() => {
    const hash = hashString(seedString);
    const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
    const shapeType = (hash >> 3) % 6;
    const eyeType = (hash >> 6) % 5;
    const mouthType = (hash >> 9) % 4;
    const accessory = (hash >> 12) % 6;
    const initial = name.trim().charAt(0).toUpperCase() || 'P';

    return {
      hash,
      palette,
      shapeType,
      eyeType,
      mouthType,
      accessory,
      initial
    };
  }, [seedString, name]);

  const { palette, shapeType, eyeType, mouthType, accessory, initial, hash } = avatarData;
  const gradientId = `avatar-grad-${hash}`;

  // If user has custom icon & color legacy
  if (user.icon && user.color) {
    return (
      <div 
        className={`flex items-center justify-center font-bold text-white shadow-sm rounded-2xl ${user.color} ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-sm select-none">{user.icon}</span>
      </div>
    );
  }

  return (
    <div 
      className={`relative inline-flex items-center justify-center rounded-2xl overflow-hidden shadow-sm shrink-0 select-none border border-slate-700/40 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor={palette.from} />
            <stop offset="1" stopColor={palette.to} />
          </linearGradient>
          <filter id={`shadow-${hash}`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Base Background */}
        <rect width="80" height="80" rx="20" fill={palette.bg} />

        {/* Ambient geometric background shapes */}
        <circle cx="20" cy="15" r="22" fill={palette.from} fillOpacity="0.25" />
        <circle cx="65" cy="65" r="26" fill={palette.to} fillOpacity="0.2" />

        {/* Main Character Body / Geometric Base */}
        {shapeType === 0 && (
          <rect x="18" y="18" width="44" height="44" rx="14" fill={`url(#${gradientId})`} />
        )}
        {shapeType === 1 && (
          <circle cx="40" cy="40" r="24" fill={`url(#${gradientId})`} />
        )}
        {shapeType === 2 && (
          <path
            d="M40 14 L66 32 L66 60 L40 68 L14 60 L14 32 Z"
            fill={`url(#${gradientId})`}
          />
        )}
        {shapeType === 3 && (
          <path
            d="M40 15 C54 15 64 26 64 42 C64 58 52 66 40 66 C28 66 16 58 16 42 C16 26 26 15 40 15 Z"
            fill={`url(#${gradientId})`}
          />
        )}
        {shapeType === 4 && (
          <g>
            <rect x="16" y="24" width="48" height="38" rx="12" fill={`url(#${gradientId})`} />
            <circle cx="28" cy="18" r="6" fill={palette.from} />
            <circle cx="52" cy="18" r="6" fill={palette.to} />
          </g>
        )}
        {shapeType === 5 && (
          <g>
            <rect x="18" y="18" width="44" height="44" rx="16" fill={`url(#${gradientId})`} />
            <rect x="24" y="24" width="32" height="32" rx="10" fill="#0B0E14" fillOpacity="0.35" />
          </g>
        )}

        {/* Face Elements: Eyes */}
        {eyeType === 0 && (
          <g fill="#FFFFFF">
            <circle cx="31" cy="36" r="3.5" />
            <circle cx="49" cy="36" r="3.5" />
            <circle cx="32" cy="35" r="1.2" fill="#0B0E14" />
            <circle cx="50" cy="35" r="1.2" fill="#0B0E14" />
          </g>
        )}
        {eyeType === 1 && (
          <g stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
            <path d="M28 36 Q32 32 36 36" />
            <path d="M44 36 Q48 32 52 36" />
          </g>
        )}
        {eyeType === 2 && (
          <g fill="#FFFFFF">
            <rect x="28" y="34" width="7" height="4" rx="2" />
            <rect x="45" y="34" width="7" height="4" rx="2" />
          </g>
        )}
        {eyeType === 3 && (
          <g stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round">
            <line x1="28" y1="36" x2="35" y2="36" />
            <line x1="45" y1="36" x2="52" y2="36" />
          </g>
        )}
        {eyeType === 4 && (
          <g fill="#FFFFFF">
            <circle cx="31" cy="37" r="3" />
            <path d="M44 37 L52 33 L52 41 Z" fill="#FFFFFF" />
          </g>
        )}

        {/* Face Elements: Mouth */}
        {mouthType === 0 && (
          <path
            d="M34 46 Q40 52 46 46"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {mouthType === 1 && (
          <line
            x1="35"
            y1="47"
            x2="45"
            y2="47"
            stroke="#FFFFFF"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
        {mouthType === 2 && (
          <ellipse cx="40" cy="48" rx="3.5" ry="4" fill="#FFFFFF" fillOpacity="0.9" />
        )}
        {mouthType === 3 && (
          <path
            d="M33 46 C36 49 44 49 47 46 Z"
            fill="#FFFFFF"
          />
        )}

        {/* Subtle decorative badges */}
        {accessory === 0 && (
          <circle cx="63" cy="18" r="4" fill="#FBBF24" />
        )}
        {accessory === 1 && (
          <rect x="58" y="14" width="7" height="7" rx="2" transform="rotate(45 61.5 17.5)" fill="#38BDF8" />
        )}
        {accessory === 2 && (
          <path d="M16 18 L21 21 L16 24 Z" fill="#34D399" />
        )}

        {/* Initial overlay badge in corner for crisp identity */}
        <rect x="4" y="56" width="20" height="20" rx="7" fill="#0B0E14" fillOpacity="0.75" />
        <text
          x="14"
          y="70"
          textAnchor="middle"
          fill="#E2E8F0"
          fontSize="11"
          fontWeight="bold"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {initial}
        </text>
      </svg>
    </div>
  );
};
