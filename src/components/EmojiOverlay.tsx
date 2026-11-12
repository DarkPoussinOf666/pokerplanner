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
  const rAFRef = useRef<number>();
  const lastTimeRef = useRef<number>(performance.now());
  const [renderedEmojis, setRenderedEmojis] = useState<EmojiEventPayload[]>([]);

  // Sync emojis prop with rendered list and physics state
  useEffect(() => {
    const currentPhysics = physicsEmojisRef.current;
    
    emojis.forEach(e => {
      if (!currentPhysics.has(e.id)) {
        // e.x and e.y are click point percentages (0 to 100)
        const targetX = (e.x / 100) * window.innerWidth;
        const targetY = (e.y / 100) * window.innerHeight;

        // Determine closest lateral edge (left or right side)
        const isLeftClosest = targetX < window.innerWidth / 2;
        const startX = isLeftClosest ? -60 : window.innerWidth + 60;
        
        // Start Y is close to the target Y with small random offset
        const startY = Math.min(Math.max(targetY + (Math.random() * 80 - 40), 60), window.innerHeight - 60);

        // Calculate velocity trajectory to hit target
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const speed = 1200 + Math.random() * 300; // Base speed px/s
        const t = Math.max(distance / speed, 0.25); // Estimated time to target in seconds
        
        const GRAVITY = 1500; // Must match physics loop GRAVITY
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
          life: 4000 // 4 seconds max life
        });
      }
    });

    setRenderedEmojis(Array.from(currentPhysics.values()).map((pe: PhysicsEmoji) => ({
      id: pe.id,
      emoji: pe.emoji,
      senderName: pe.senderName,
      x: 0,
      y: 0
    })));
  }, [emojis]);

  // Physics loop
  useEffect(() => {
    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05); // cap dt
      lastTimeRef.current = time;
      
      const currentPhysics = physicsEmojisRef.current;
      const GRAVITY = 1500;
      
      // Get all card bounds
      const cards = document.querySelectorAll('.participant-card');
      const cardBounds = Array.from(cards).map(card => {
        return {
          id: card.id,
          rect: card.getBoundingClientRect()
        };
      });

      let stateChanged = false;

      currentPhysics.forEach((pe, id) => {
        pe.life -= dt * 1000;
        
        // Physics integration
        pe.vy += GRAVITY * dt;
        pe.x += pe.vx * dt;
        pe.y += pe.vy * dt;

        // Collision with participant cards
        let hitSomething = false;
        const EMOJI_SIZE = 40; // rough box size
        
        for (const card of cardBounds) {
          if (!pe.hasHit.has(card.id)) {
            // AABB Collision check
            if (
              pe.x < card.rect.right &&
              pe.x + EMOJI_SIZE > card.rect.left &&
              pe.y < card.rect.bottom &&
              pe.y + EMOJI_SIZE > card.rect.top
            ) {
              pe.hasHit.add(card.id);
              hitSomething = true;
              
              // Bounce effect on impact!
              pe.vy = -Math.abs(pe.vy) * 0.5 - 200; // Bounce up
              pe.vx *= -0.5; // Reverse horizontal momentum slightly
            }
          }
        }

        if (hitSomething) {
          playPopSound();
        }

        // Update DOM element
        if (pe.element) {
          pe.element.style.transform = `translate(${pe.x}px, ${pe.y}px)`;
          // Fade out at end of life
          if (pe.life < 500) {
            pe.element.style.opacity = (pe.life / 500).toString();
          }
        }

        // Remove dead emojis or ones that fell far below screen
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

      rAFRef.current = requestAnimationFrame(loop);
    };

    rAFRef.current = requestAnimationFrame(loop);

    return () => {
      if (rAFRef.current) cancelAnimationFrame(rAFRef.current);
    };
  }, []);

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
