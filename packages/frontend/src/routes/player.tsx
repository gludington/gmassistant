import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import type { BroadcastMessage, LiveCombatant, SceneFit } from '@gmassisstant/types';
import { useBroadcastReceiver } from '../hooks/useBroadcast';
import { conditionIcon } from '../conditions';

export const Route = createFileRoute('/player')({
  component: PlayerScreen,
});

// ── Injected styles ───────────────────────────────────────────────────────────

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Cinzel+Decorative:wght@900&display=swap');

  @keyframes cardRise {
    from { opacity: 0; transform: translateY(-32px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes trackerFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .tracker-bar {
    animation: trackerFadeIn 0.4s ease forwards;
  }
  .tracker-card {
    animation: cardRise 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .tracker-card.dead {
    filter: grayscale(1) brightness(0.3);
  }
  @keyframes activePulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.75; }
  }
  .tracker-card.active .active-indicator {
    animation: activePulse 1.4s ease-in-out infinite;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

// ── Component ─────────────────────────────────────────────────────────────────

function PlayerScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFit, setImageFit] = useState<SceneFit>('fit');
  const [combatants, setCombatants] = useState<LiveCombatant[]>([]);
  const [initiativeVisible, setInitiativeVisible] = useState(false);
  const [showHp, setShowHp] = useState(false);
  const [showInitiative, setShowInitiative] = useState(false);
  const [activeCombatantId, setActiveCombatantId] = useState<number | null>(null);
  const [round, setRound] = useState<number | null>(null);
  const [needsClick, setNeedsClick] = useState(false);

  useEffect(() => {
    document.documentElement.requestFullscreen().catch(() => setNeedsClick(true));
  }, []);

  useEffect(() => {
    function applyStorage(raw: string | null) {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw) as { combatants: LiveCombatant[]; visible: boolean; showHp?: boolean; showInitiative?: boolean; activeCombatantId?: number | null; round?: number };
        if (Array.isArray(saved.combatants)) setCombatants(saved.combatants);
        setInitiativeVisible(!!saved.visible);
        if (saved.showHp !== undefined) setShowHp(saved.showHp);
        if (saved.showInitiative !== undefined) setShowInitiative(saved.showInitiative);
        setActiveCombatantId(saved.activeCombatantId ?? null);
        if (saved.round !== undefined) setRound(saved.round);
      } catch {}
    }

    applyStorage(localStorage.getItem('gma:initiative'));

    function onStorage(e: StorageEvent) {
      if (e.key === 'gma:initiative') applyStorage(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function enterFullscreen() {
    setNeedsClick(false);
    document.documentElement.requestFullscreen().catch(() => {});
  }

  const handleMessage = useCallback((msg: BroadcastMessage) => {
    switch (msg.type) {
      case 'SHOW_IMAGE':       setImage(msg.payload.filePath); setImageFit(msg.payload.fit); setInitiativeVisible(false); break;
      case 'CLEAR_IMAGE':      setImage(null); break;
      case 'UPDATE_INITIATIVE': setCombatants(msg.payload.combatants); setActiveCombatantId(msg.payload.activeCombatantId ?? null); if (msg.payload.round !== undefined) setRound(msg.payload.round); break;
      case 'TOGGLE_INITIATIVE': setInitiativeVisible(msg.payload.visible); break;
      case 'SET_SHOW_HP': setShowHp(msg.payload.showHp); break;
      case 'SET_SHOW_INITIATIVE': setShowInitiative(msg.payload.showInitiative); break;
    }
  }, []);

  useBroadcastReceiver(handleMessage);

  const sorted = [...combatants].sort((a, b) => (b.initiative ?? -999) - (a.initiative ?? -999));

  return (
    <div style={s.screen}>
      <style>{GLOBAL_STYLES}</style>

      {needsClick && (
        <div style={s.fullscreenPrompt} onClick={enterFullscreen}>
          <span style={s.fullscreenText}>Click to enter fullscreen</span>
        </div>
      )}

      {image ? (
        <img src={image} alt="" style={imageFit === 'center' ? s.imageCenter : imageFit === 'cover' ? s.imageCover : s.imageFit} />
      ) : (
        <div style={s.placeholder}>
          <span style={s.placeholderText}>⚔</span>
        </div>
      )}

      {initiativeVisible && sorted.length > 0 && (
        <div className="tracker-bar" style={s.trackerBar}>
          <div style={s.trackerBackdrop} />

          {round !== null && (
            <div style={s.roundBadge}>
              <span style={s.roundWord}>Round</span>
              <span style={s.roundNum}>{round}</span>
            </div>
          )}

          <div style={s.cards}>
            {sorted.map((c, i) => (
              <CombatantCard key={c.id} combatant={c} rank={i} showHp={showHp} showInitiative={showInitiative} isActive={c.id === activeCombatantId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CombatantCard ─────────────────────────────────────────────────────────────

function CombatantCard({ combatant: c, rank, showHp, showInitiative, isActive }: { combatant: LiveCombatant; rank: number; showHp: boolean; showInitiative: boolean; isActive: boolean }) {
  const isGroup = c.type === 'group' && c.members && c.members.length > 0;
  const dead = isGroup ? (c.members!.every((m) => m.currentHp === 0)) : c.currentHp === 0;
  const hpPct = !isGroup && c.maxHp > 0 ? (c.currentHp / c.maxHp) * 100 : 0;
  const hpColor = hpPct > 60 ? '#4caf50' : hpPct > 25 ? '#ff9800' : '#ef5350';
  const accent = c.color ?? '#c9a84c';

  return (
    <div
      className={`tracker-card${dead ? ' dead' : ''}${isActive ? ' active' : ''}`}
      style={{
        ...s.card,
        borderLeftColor: accent,
        animationDelay: `${rank * 0.06}s`,
        boxShadow: isActive
          ? `inset 0 0 40px rgba(0,0,0,0.5), 0 0 0 2px ${accent}, 0 0 40px ${accent}88`
          : dead ? 'none' : `inset 0 0 40px rgba(0,0,0,0.6), 0 0 20px rgba(0,0,0,0.8)`,
        background: isActive ? `rgba(20, 18, 5, 0.97)` : 'rgba(8, 6, 20, 0.92)',
      }}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="active-indicator" style={s.activeIndicator}>▶ Active</div>
      )}

      {/* Top row: initiative (left) + name + conditions (right) */}
      <div style={s.cardTopRow}>
        {showInitiative && (
          <div style={{ ...s.initNum, textShadow: `0 0 30px ${accent}88` }}>
            {c.initiative ?? '—'}
          </div>
        )}
          <div style={s.cardNameBlock}>
            <span style={s.name}>{dead ? '☠ ' : ''}{c.name.toUpperCase()}</span>

            {/* HP row */}
            {isGroup ? (
              isActive && (
                <div style={s.memberGrid}>
                  {c.members!.map((m) => {
                    const mDead = m.currentHp === 0;
                    const mPct = m.maxHp > 0 ? (m.currentHp / m.maxHp) * 100 : 0;
                    const mColor = mPct > 60 ? '#4caf50' : mPct > 25 ? '#ff9800' : '#ef5350';
                    const mConds = m.conditions ?? [];
                    return (
                      <div key={m.id} style={{ ...s.memberCell, opacity: mDead ? 0.3 : 1 }}>
                        <div style={s.memberNameRow}>
                          <span style={s.memberLabel}>{m.label}</span>
                          {mConds.length > 0 && (
                            <div style={s.memberConditions}>
                              {mConds.map((cond) => (
                                <span key={cond} style={s.condEmoji} title={cond}>{conditionIcon(cond)}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {showHp && (
                          <>
                            <div style={{ ...s.barTrack, width: '100%' }}>
                              <div style={{ ...s.barFill, width: `${mPct}%`, background: mDead ? '#333' : mColor }} />
                            </div>
                            <span style={{ ...s.memberHp, color: mDead ? '#555' : mColor }}>
                              {m.currentHp}<span style={s.hpMax}>/{m.maxHp}</span>
                            </span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              showHp && (
                <div style={s.hpRow}>
                  <span style={{ ...s.hp, color: dead ? '#555' : hpColor }}>
                    {c.currentHp}<span style={s.hpMax}> / {c.maxHp}</span>
                  </span>
                  <div style={{ ...s.barTrack, flex: 1 }}>
                    <div style={{ ...s.barFill, width: `${hpPct}%`, background: dead ? '#333' : hpColor }} />
                  </div>
                </div>
              )
            )}
          </div>

          {/* Conditions: single row flush right */}
          {c.conditions.length > 0 && (
            <div style={s.conditions}>
              {c.conditions.map((cond) => (
                <div key={cond} style={s.condChip} title={cond}>
                  <span style={s.condEmoji}>{conditionIcon(cond)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  screen: {
    width: '100vw',
    height: '100vh',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  imageFit: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  imageCover: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageCenter: {
    width: 'auto',
    height: 'auto',
    maxWidth: '100%',
    maxHeight: '100%',
  },
  placeholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    fontSize: '8rem',
    opacity: 0.07,
    color: '#fff',
  },
  fullscreenPrompt: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.85)',
    cursor: 'pointer',
    zIndex: 100,
  },
  fullscreenText: {
    color: '#aaa',
    fontSize: '1.4rem',
    letterSpacing: '0.1em',
    fontFamily: 'serif',
  },

  // ── Round badge ───────────────────────────────────────────────────────────
  roundBadge: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.5rem',
    padding: '1rem 1.2rem 0.7rem',
    borderBottom: '1px solid rgba(201,168,76,0.2)',
    zIndex: 2,
  },
  roundWord: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(0.6rem, 0.9vw, 0.95rem)',
    letterSpacing: '0.2em',
    color: '#c9a84c',
    textTransform: 'uppercase' as const,
    opacity: 0.7,
    lineHeight: 1,
  },
  roundNum: {
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
    fontSize: 'clamp(1.4rem, 2.2vw, 2.8rem)',
    fontWeight: 900,
    color: '#c9a84c',
    lineHeight: 1,
    textShadow: '0 0 24px #c9a84c88',
  },

  // ── Tracker ──────────────────────────────────────────────────────────────
  trackerBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 'clamp(800px, 92vw, 1800px)',
    zIndex: 10,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  trackerBackdrop: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to right, rgba(4, 3, 12, 0.97) 80%, transparent 100%)',
    pointerEvents: 'none',
  },
  cards: {
    position: 'relative',
    columnCount: 3,
    columnGap: '0.6rem',
    columnFill: 'auto' as const,
    padding: '0.8rem 1rem 2rem',
    flex: 1,
    minHeight: 0,
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    breakInside: 'avoid' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.3rem',
    background: 'rgba(8, 6, 20, 0.92)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderLeft: '6px solid #c9a84c',
    borderRadius: '3px',
    padding: '0.8rem 1.1rem',
    backdropFilter: 'blur(4px)',
    marginBottom: '0.6rem',
  },
  activeIndicator: {
    fontFamily: "'Cinzel', serif",
    fontSize: '0.8rem',
    letterSpacing: '0.2em',
    color: '#c9a84c',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
  },
  cardTopRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  cardNameBlock: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.4rem',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  initNum: {
    fontFamily: "'Cinzel Decorative', 'Cinzel', serif",
    fontSize: 'clamp(2.8rem, 5vw, 6rem)',
    fontWeight: 900,
    lineHeight: 1,
    color: '#c9a84c',
    letterSpacing: '-0.03em',
    flexShrink: 0,
    minWidth: '2ch',
    textAlign: 'right' as const,
  },
  name: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(1.5rem, 2.8vw, 3.2rem)',
    fontWeight: 900,
    lineHeight: 1.05,
    color: '#f5edd8',
    letterSpacing: '0.06em',
    wordBreak: 'break-word' as const,
  },
  hpRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
  },
  hp: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(1.1rem, 2vw, 2.2rem)',
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  },
  hpMax: {
    fontSize: '0.6em',
    opacity: 0.45,
  },
  barTrack: {
    height: '5px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), background 0.6s ease',
  },
  memberGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  memberCell: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '0.2rem',
    minWidth: 64,
  },
  memberNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  },
  memberConditions: {
    display: 'flex',
    gap: '0.15rem',
    flexWrap: 'wrap' as const,
  },
  memberLabel: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(0.75rem, 1.2vw, 1.3rem)',
    fontWeight: 700,
    color: '#f5edd8',
    letterSpacing: '0.04em',
  },
  memberHp: {
    fontFamily: "'Cinzel', serif",
    fontSize: 'clamp(0.7rem, 1.1vw, 1.2rem)',
    fontWeight: 600,
  },
  conditions: {
    display: 'flex',
    flexDirection: 'row' as const,
    flexWrap: 'nowrap' as const,
    gap: '0.3rem',
    alignItems: 'center',
    flexShrink: 0,
  },
  condChip: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    padding: '0.1rem 0.25rem',
    lineHeight: 1,
  },
  condEmoji: {
    fontSize: 'clamp(1.4rem, 2.4vw, 2.8rem)',
    lineHeight: 1,
  },
};
