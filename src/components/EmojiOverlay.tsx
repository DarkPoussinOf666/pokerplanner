import React, { useEffect, useRef, useState } from 'react';
import { EmojiEventPayload } from '../types';
import { playPopSound } from '../audio';

interface EmojiOverlayProps {
  emojis: EmojiEventPayload[];
}

interface PhysicsEmoji {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  element?: HTMLDivElement;
  hasHit: Set<string>; // keep track of cards it already hit so it doesn't multi-hit
  life: number;
}

export const EmojiOverlay: React.FC<EmojiOverlayProps> = ({ emojis }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const physicsEmojisRef = useRef<Map<string, PhysicsEmoji>>(new Map());
  const cardBoundsRef = useRef<Array<{ id: string; rect: DOMRect }>>([]);
  const rAFRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const [renderedEmojis, setRenderedEmojis] = useState<EmojiEventPayload[]>([]);

  const refreshCardBounds = () => {
    const cards = document.querySelectorAll('.participant-card');
    cardBoundsRef.current = Array.from(cards).map(card => ({
      id: card.id,
      rect: card.getBoundingClientRect()
    }));
  };

  useEffect(() => {
    const onResize = () => {
      if (physicsEmojisRef.current.size > 0) {
        refreshCardBounds();
      }
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (rAFRef.current !== null) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }
    };
  }, []);

  const startLoopIfNeeded = () => {
    if (rAFRef.current !== null || physicsEmojisRef.current.size === 0) {
      return;
    }

    lastTimeRef.current = performance.now();

    const loop = (time: number) => {
      const currentPhysics = physicsEmojisRef.current;
      if (currentPhysics.size === 0) {
        rAFRef.current = null;
        return;
      }

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      const GRAVITY = 1500;
      const cardBounds = cardBoundsRef.current;
      let stateChanged = false;

      currentPhysics.forEach((pe, id) => {
        pe.life -= dt * 1000;

        pe.vy += GRAVITY * dt;
        pe.x += pe.vx * dt;
        pe.y += pe.vy * dt;

        let hitSomething = false;
        const EMOJI_SIZE = 40;

        for (const card of cardBounds) {
          if (!pe.hasHit.has(card.id)) {
            if (
              pe.x < card.rect.right &&
              pe.x + EMOJI_SIZE > card.rect.left &&
              pe.y < card.rect.bottom &&
              pe.y + EMOJI_SIZE > card.rect.top
            ) {
              pe.hasHit.add(card.id);
              hitSomething = true;

              pe.vy = -Math.abs(pe.vy) * 0.5 - 200;
              pe.vx *= -0.5;
            }
          }
        }

        if (hitSomething) {
          playPopSound();
        }

        if (pe.element) {
          pe.element.style.transform = `translate(${pe.x}px, ${pe.y}px)`;
          if (pe.life < 500) {
            pe.element.style.opacity = Math.max(0, pe.life / 500).toString();
          }
        }

        if (pe.life <= 0 || pe.y > window.innerHeight + 200) {
          currentPhysics.delete(id);
          stateChanged = true;
        }
      });

      if (stateChanged) {
        setRenderedEmojis(Array.from(currentPhysics.values()).map((pe: PhysicsEmoji) => ({
          id: pe.id,
          emoji: pe.emoji,
          senderName: pe.senderName,
          x: 0,
          y: 0
        })));
      }

      if (currentPhysics.size > 0) {
        rAFRef.current = requestAnimationFrame(loop);
      } else {
        rAFRef.current = null;
      }
    };

    rAFRef.current = requestAnimationFrame(loop);
  };

  // Sync emojis prop with rendered list and physics state
  useEffect(() => {
    const currentPhysics = physicsEmojisRef.current;
    let addedNew = false;

    emojis.forEach(e => {
      if (!currentPhysics.has(e.id)) {
        addedNew = true;
        const targetX = (e.x / 100) * window.innerWidth;
        const targetY = (e.y / 100) * window.innerHeight;

        const isLeftClosest = targetX < window.innerWidth / 2;
        const startX = isLeftClosest ? -60 : window.innerWidth + 60;

        const startY = Math.min(Math.max(targetY + (Math.random() * 80 - 40), 60), window.innerHeight - 60);

        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const speed = 1200 + Math.random() * 300;
        const t = Math.max(distance / speed, 0.25);

        const GRAVITY = 1500;
        const vx = dx / t;
        const vy = (dy - 0.5 * GRAVITY * t * t) / t;

        currentPhysics.set(e.id, {
          id: e.id,
          emoji: e.emoji,
          senderName: e.senderName,
          x: startX,
          y: startY,
          vx: vx,
          vy: vy,
          hasHit: new Set(),
          life: 4000
        });
      }
    });

    if (addedNew) {
      refreshCardBounds();
      setRenderedEmojis(Array.from(currentPhysics.values()).map((pe: PhysicsEmoji) => ({
        id: pe.id,
        emoji: pe.emoji,
        senderName: pe.senderName,
        x: 0,
        y: 0
      })));
      startLoopIfNeeded();
    }
  }, [emojis]);

  return (
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {renderedEmojis.map((item) => (
        <div
          key={item.id}
          ref={(el) => {
            const pe = physicsEmojisRef.current.get(item.id);
            if (pe && el) {
              pe.element = el;
              el.style.transform = `translate(${pe.x}px, ${pe.y}px)`;
            }
          }}
          className="absolute left-0 top-0 flex flex-col items-center select-none"
          style={{ willChange: 'transform' }}
        >
          <span className="text-4xl sm:text-5xl drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]">
            {item.emoji}
          </span>
          <span className="text-[10px] font-bold bg-slate-900/90 text-white border border-slate-700 px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap mt-1">
            {item.senderName}
          </span>
        </div>
      ))}
    </div>
  );
};
