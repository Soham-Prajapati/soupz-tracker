/* ============================================================
   Soupz — the drawing kit.

   Everything visual in this app is one of five marks: the bowl,
   the broth, the steam, the noodle and the ink line. This file
   draws all five. Nothing here knows anything about the plan —
   it only knows how full something is.
   ============================================================ */
import React, { useMemo } from 'react';

/* ---------- shared filters ---------- */
/* One hidden <svg> mounted once at the root. Every other drawing in
   the app points at these ids, so the wobble is consistent — the same
   hand drew all of it. */
export function InkDefs() {
  return (
    <svg className="ink-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id="wob" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.032" numOctaves="2" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="wob-s" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="3" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="wob-l" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/* ---------- the geometry of one bowl ----------
   The bowl is a spheroid seen from slightly above. Everything else follows
   from that: the rim is the widest circle, the liquid surface is a smaller
   circle at some depth, and both project to ellipses with the same squash.
   Getting this right is the difference between liquid sitting in a bowl and
   colour painted onto one. */
const RIM_Y = 64;        // the plane of the rim
const RIM_X = 88;        // half-width there
const DEPTH = 68;        // rim plane down to the inside of the base
const SQUASH = 0.136;    // how open a circle looks from this angle
const FLOOR = RIM_Y + DEPTH;
const FULL = RIM_Y + 2;  // brimming, but the rim still draws in front

// half-width of the liquid at depth y
const halfAt = (y) => {
  const t = Math.min(1, Math.max(0, (y - RIM_Y) / DEPTH));
  return RIM_X * Math.sqrt(Math.max(0, 1 - t * t));
};

// the volume you can actually see into: inside the rim, above the base
const INTERIOR =
  'M22,64 C22,56 60,52 110,52 C160,52 198,56 198,64 ' +
  'C196,102 160,132 110,132 C60,132 24,102 22,64 Z';

/* A wobbling wave, used for every liquid surface in the app. */
function wave(y, w, amp, seg, phase = 0) {
  let d = `M${-seg * 2},${y + Math.sin(phase) * amp}`;
  for (let x = -seg * 2; x < w + seg * 4; x += seg) {
    d += ` q ${seg / 2},${amp} ${seg},0 q ${seg / 2},${-amp} ${seg},0`;
  }
  return d;
}

/* ---------- ingredients ---------- */
/* Each track earns a garnish. They are drawn small and dropped into
   the broth as the work behind them gets done. */
function Garnish({ kind, c, x, y, i }) {
  const s = { animationDelay: `${(i % 5) * 0.7}s` };
  const common = { stroke: c, strokeWidth: 2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  /* The bob lives on an inner group: a CSS transform would otherwise replace
     the positioning transform and pile every garnish up in the corner. */
  return (
    <g transform={`translate(${x} ${y})`}>
    <g className="garnish" style={s} filter="url(#wob-s)">
      {kind === 'noodle' && <path d="M-9,2 q4,-6 8,0 t8,0 t3,-1" {...common} />}
      {kind === 'ring' && (<><circle r="5.5" {...common} /><circle r="2" {...common} strokeWidth="1.5" /></>)}
      {kind === 'leaf' && <path d="M-6,3 q6,-11 12,-3 q-7,7 -12,3z" {...common} fill={c} fillOpacity=".22" />}
      {kind === 'star' && <path d="M0,-6 L1.7,-1.8 L6,-1.5 L2.6,1.4 L3.9,5.6 L0,3.1 L-3.9,5.6 L-2.6,1.4 L-6,-1.5 L-1.7,-1.8 Z" {...common} fill={c} fillOpacity=".2" />}
      {kind === 'chili' && <path d="M-6,4 q5,-8 11,-6 q-1,8 -11,6z M5,-2 q1,-4 3,-4" {...common} fill={c} fillOpacity=".2" />}
      {kind === 'dice' && <rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" {...common} fill={c} fillOpacity=".18" />}
      {kind === 'sprout' && <path d="M0,5 L0,-3 M0,-1 q-6,-2 -6,-6 q6,0 6,6 M0,-3 q5,-2 5,-6 q-5,1 -5,6" {...common} />}
      {kind === 'corn' && <path d="M-4,5 q-2,-9 4,-10 q6,1 4,10 z" {...common} fill={c} fillOpacity=".2" />}
    </g>
    </g>
  );
}

/* ---------- the bowl ---------- */
/* The one object the whole app is built around. Broth level is the
   only input that matters; everything else is seasoning. */
export function Bowl({
  pct = 0, size = 260, heat = true, garnish = [], caption, sub, className = '', flat = false,
}) {
  const H = 160, W = 220;
  const p = Math.max(0, Math.min(1, pct));
  const level = FLOOR - 4 - (FLOOR - 4 - FULL) * p;
  const rx = halfAt(level) * 1.04;             // a touch wide, so it meets the wall
  const ry = Math.max(2, rx * SQUASH);         // same squash as the rim
  const uid = useMemo(() => 'b' + Math.random().toString(36).slice(2, 8), []);
  const cid = uid + 'c', gid = uid + 'g', sid = uid + 's';
  /* The liquid is drawn as a surface you look down into, not a block of colour:
     the far edge of the surface curves up behind, the near edge curves down
     toward you, and the body hangs below it. */
  const front = `M${110 - rx},${level} Q110,${level + ry * 2} ${110 + rx},${level}`;
  const back  = `M${110 - rx},${level} Q110,${level - ry * 2} ${110 + rx},${level}`;

  return (
    <div className={'bowl ' + className} style={{ width: size }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }} role="img"
        aria-label={caption ? `${caption}, ${Math.round(p * 100)} percent full` : `${Math.round(p * 100)} percent full`}>
        <defs>
          <clipPath id={cid}><path d={INTERIOR} /></clipPath>
          {/* deeper at the bottom, where you cannot see the base */}
          <linearGradient id={gid} x1="0" y1={level} x2="0" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--broth)" />
            <stop offset="1" stopColor="var(--broth2)" />
          </linearGradient>
          {/* light landing on the surface, from the same window as the page */}
          <radialGradient id={sid} cx="0.36" cy="0.3" r="0.85">
            <stop offset="0" stopColor="var(--broth-lit)" />
            <stop offset="1" stopColor="var(--broth)" />
          </radialGradient>
          <clipPath id={sid + 'c'}>
            <ellipse cx="110" cy={level} rx={rx} ry={ry} />
          </clipPath>
        </defs>

        {/* the bowl sits on something */}
        <ellipse cx="112" cy="147" rx="58" ry="6" fill="var(--ink)" opacity=".10" />

        {/* steam — three strands, only when something is cooking */}
        {heat && !flat && (
          <g className="steam" filter="url(#wob-s)">
            {[[78, 0], [110, 0.9], [142, 1.8]].map(([x, d], i) => (
              <path key={i} className="steam-p" style={{ animationDelay: `${d}s` }}
                d={`M${x},46 c 9,-11 -9,-17 0,-28 c 9,-11 -7,-15 0,-22`}
                stroke="var(--steam)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            ))}
          </g>
        )}

        {/* broth */}
        {p > 0.004 && (
          <g clipPath={`url(#${cid})`}>
            {/* the body of the liquid, hanging below the near edge of the surface */}
            <path d={`${front} L${110 + rx},${H} L${110 - rx},${H} Z`} fill={`url(#${gid})`} />
            {/* where the liquid meets the wall it goes darker — this is the line
                between "filled" and "painted" */}
            <path d={INTERIOR} fill="none" stroke="var(--ink)" strokeWidth="7" opacity=".13" />

            {/* the surface itself */}
            <ellipse cx="110" cy={level} rx={rx} ry={ry} fill={`url(#${sid})`} />
            <g clipPath={`url(#${sid}c)`}>
              <path className="wv wv-1" d={wave(level - ry * 0.15, W, 1.6, 20)} fill="var(--broth2)" opacity=".28" />
              <path className="wv wv-2" d={wave(level + ry * 0.35, W, 1.2, 27)} fill="var(--broth-lit)" opacity=".35" />
            </g>
            {/* meniscus: the liquid climbs the wall a little at the back */}
            <path d={back} fill="none" stroke="var(--broth-lit)" strokeWidth="1.6" opacity=".75" />
            <path d={front} fill="none" stroke="var(--broth2)" strokeWidth="1.4" opacity=".5" />
            {/* one small specular, so it looks wet */}
            {rx > 26 && <ellipse cx={110 - rx * 0.34} cy={level - ry * 0.28} rx={rx * 0.2} ry={ry * 0.3}
              fill="#fff" opacity=".22" />}

            {garnish.map((g, i) => {
              /* garnish floats on the surface, so it follows the ellipse */
              const n = garnish.length;
              const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
              return (
                <Garnish key={i} kind={g.kind} c={g.c} i={i}
                  x={110 + t * rx * 0.64}
                  y={level + ry * (0.35 + (i % 2 ? 0.5 : 0)) * Math.cos(t * 1.2)} />
              );
            })}
          </g>
        )}

        {/* the bowl itself, drawn last so the ink sits on top of the broth */}
        <g filter="url(#wob)" fill="none" stroke="var(--ink)" strokeLinecap="round" strokeWidth="2.6">
          {/* outside wall */}
          <path d="M20,63 C22,110 58,141 110,141 C162,141 198,110 200,63" />
          {/* the rim: back edge over the top, then the inner front edge */}
          <path d="M20,63 C20,54 58,49 110,49 C162,49 200,54 200,63" strokeWidth="2.4" />
          <path d="M22,64 C22,72 60,76 110,76 C160,76 198,72 198,64" strokeWidth="1.9" opacity=".8" />
          <path d="M84,141 C90,151 130,151 136,141" strokeWidth="2.2" />
          <path d="M44,116 q10,10 24,14" strokeWidth="1.4" opacity=".45" />
        </g>
      </svg>
      {caption && <div className="bowl-cap"><b>{caption}</b>{sub && <span>{sub}</span>}</div>}
    </div>
  );
}

/* ---------- top-down bowl, used wherever a percentage needs a shape ---------- */
export function Cup({ pct = 0, size = 66, c = 'var(--broth)', label, value }) {
  const p = Math.max(0, Math.min(1, pct));
  const uid = useMemo(() => 'cup' + Math.random().toString(36).slice(2, 8), []);
  const cid = uid + 'c', gid = uid + 'g';
  /* Below about 30px the saucer ring costs more than it gives — the liquid
     needs the room, because at that size the fill level IS the information. */
  const tiny = size < 30;
  const R = tiny ? 23 : 19;
  const level = (26 + R + 0.5) - 2 * R * p;
  /* half-width of the circle at the liquid level, so the surface sits
     inside the cup instead of running straight across it */
  const dy = Math.max(-R, Math.min(R, level - 26));
  const half = Math.sqrt(Math.max(0, R * R - dy * dy));
  return (
    <div className="cup" style={{ width: size }}>
      <svg viewBox="0 0 52 52" width="100%" style={{ display: 'block' }} role="img"
        aria-label={`${label || ''} ${Math.round(p * 100)} percent`}>
        <defs>
          <clipPath id={cid}><circle cx="26" cy="26" r={R} /></clipPath>
          <linearGradient id={gid} x1="0" y1={level} x2="0" y2={26 + R} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={c} stopOpacity=".9" />
            <stop offset="1" stopColor={c} />
          </linearGradient>
        </defs>
        <g clipPath={`url(#${cid})`}>
          <circle cx="26" cy="26" r={R} fill="var(--paper2)" />
          {p > 0.004 && <>
            <rect x="0" y={level} width="52" height="52" fill={`url(#${gid})`} />
            <path className="wv wv-1" d={wave(level, 52, 1.4, 11)} fill={c} />
            {half > 3 && <ellipse cx="26" cy={level} rx={half} ry={Math.max(1, half * 0.16)}
              fill="#fff" opacity=".2" />}
          </>}
          <circle cx="26" cy="26" r={R} fill="none" stroke="var(--ink)" strokeWidth="3" opacity=".12" />
        </g>
        <g filter="url(#wob-s)" fill="none" stroke="var(--ink)" strokeWidth={tiny ? 2.4 : 1.8}>
          <circle cx="26" cy="26" r={R} />
          {!tiny && <circle cx="26" cy="26" r="23" strokeWidth="1.2" opacity=".4" />}
        </g>
      </svg>
      {(value || label) && (
        <div className="cup-t">
          {value && <b>{value}</b>}
          {label && <span>{label}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- the noodle: every progress bar in the app ---------- */
export function Noodle({ pct = 0, c = 'var(--broth)', h = 12, w = 200, thick = 5 }) {
  const p = Math.max(0, Math.min(1, pct));
  const d = useMemo(() => {
    let s = `M2,${h / 2}`;
    const seg = 11;
    for (let x = 2; x < w; x += seg * 2) s += ` q ${seg / 2},${-3.2} ${seg},0 q ${seg / 2},${3.2} ${seg},0`;
    return s;
  }, [w, h]);
  return (
    <svg className="noodle" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke="var(--rule)" strokeWidth={thick} strokeLinecap="round" />
      {/* a round cap on a zero-length dash still draws a dot, so nothing is
          drawn at all until there is something to show */}
      {p > 0.004 && (
        <path d={d} fill="none" stroke={c} strokeWidth={thick} strokeLinecap="round"
          pathLength="100" strokeDasharray="100 200" strokeDashoffset={100 - p * 100}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)' }} />
      )}
    </svg>
  );
}

/* ---------- the tick: drawn, not stamped ---------- */
export function Tick({ on, size = 22, c = 'var(--ink)' }) {
  return (
    <svg className={'tick' + (on ? ' on' : '')} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="var(--rule)" strokeWidth="1.8" filter="url(#wob-s)" />
      {/* the tick draws itself on; hidden outright when off, because a round
          cap on an empty dash still leaves a dot of ink behind */}
      <path d="M7,12.4 L10.4,16 L17,7.8" fill="none" stroke={c} strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" pathLength="100"
        strokeDasharray="100 200" strokeDashoffset={on ? 0 : 100}
        opacity={on ? 1 : 0} filter="url(#wob-s)"
        style={{ transition: 'stroke-dashoffset .32s cubic-bezier(.4,0,.2,1),opacity .12s' }} />
    </svg>
  );
}

/* ---------- a hand-drawn rule, for separating things ---------- */
export function Rule({ w = 600, tone = 'var(--rule)' }) {
  const d = useMemo(() => {
    let s = 'M2,5';
    for (let x = 2; x < w; x += 46) s += ` q 23,${x % 92 === 2 ? -3.4 : 3.4} 46,0`;
    return s;
  }, [w]);
  return (
    <svg className="rule" viewBox={`0 0 ${w} 10`} preserveAspectRatio="none" aria-hidden="true">
      <path d={d} fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- little steam mark, for headers and labels ---------- */
export function SteamMark({ size = 18, c = 'var(--ink3)' }) {
  return (
    <svg className="smark" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" filter="url(#wob-s)">
      {[6, 12, 18].map((x, i) => (
        <path key={x} className="smark-p" style={{ animationDelay: `${i * 0.5}s` }}
          d={`M${x},20 c 4,-5 -4,-8 0,-13`} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" />
      ))}
    </svg>
  );
}

/* ---------- the ladle: marks "today" ---------- */
export function Ladle({ size = 26, c = 'var(--broth2)' }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" filter="url(#wob-s)"
      fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round">
      <path d="M20,4 L20,15" />
      <path d="M10,15 a6,6 0 0 0 12,0 z" fill={c} fillOpacity=".2" />
      <path d="M20,4 q5,0 5,4" />
    </svg>
  );
}

/* ---------- a neutral plan/list illustration for empty states ---------- */
export function EmptyStateIllustration({ size = 120 }) {
  return (
    <svg viewBox="0 0 120 90" width={size} aria-hidden="true" filter="url(#wob)"
      fill="none" stroke="var(--rule)" strokeWidth="2.4" strokeLinecap="round">
      <rect x="25" y="10" width="70" height="70" rx="8" />
      <path d="M46,10 v-2 a4,4 0 0 1 4,-4 h20 a4,4 0 0 1 4,4 v2" />
      <path d="M39,31 l4,4 7,-8" />
      <path d="M58,32 h23" />
      <circle cx="44" cy="51" r="5" strokeDasharray="2.5 3.5" />
      <path d="M58,51 h23" />
      <circle cx="44" cy="68" r="5" strokeDasharray="2.5 3.5" />
      <path d="M58,68 h16" />
    </svg>
  );
}
