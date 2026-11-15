import { useEffect, useMemo, useState } from 'react';
import { FRAMES, HEIGHT, runs, WIDTH, type Frame } from './sprite';

export type FarmerMood = 'idle' | 'talking' | 'waving';

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Frame sequence for each mood: [frame, milliseconds]. Idle blinks now and then. */
const LOOPS: Record<FarmerMood, [Frame, number][]> = {
  idle: [['idle', 3200], ['blink', 140], ['idle', 2400], ['blink', 120], ['idle', 90], ['blink', 120]],
  talking: [['talkOpen', 150], ['talkHalf', 110], ['idle', 120], ['talkOpen', 170], ['talkHalf', 120], ['blink', 110], ['talkHalf', 130]],
  waving: [['waveA', 240], ['waveB', 240]],
};

/**
 * The site's guide, drawn in pixels. `waving` waves a few times and then rests;
 * `talking` moves the mouth for as long as it is set. Still when the farmer's
 * device asks for less motion.
 */
export function Farmer({ mood = 'idle', size = 96, title, className }: { mood?: FarmerMood; size?: number; title?: string; className?: string }) {
  const [frame, setFrame] = useState<Frame>(mood === 'waving' ? 'waveA' : 'idle');

  useEffect(() => {
    if (reduced()) { setFrame(mood === 'waving' ? 'waveA' : 'idle'); return; }
    const loop = LOOPS[mood];
    let i = 0;
    let turns = 0;
    let id = 0;
    const tick = () => {
      const [f, ms] = loop[i];
      setFrame(f);
      i = (i + 1) % loop.length;
      if (i === 0) turns++;
      // A wave is a greeting: six swings, then he stands at rest and blinks.
      if (mood === 'waving' && turns >= 3) { id = window.setTimeout(() => runIdle(), ms); return; }
      id = window.setTimeout(tick, ms);
    };
    const runIdle = () => {
      const idle = LOOPS.idle;
      let k = 0;
      const step = () => { const [f, ms] = idle[k]; setFrame(f); k = (k + 1) % idle.length; id = window.setTimeout(step, ms); };
      step();
    };
    tick();
    return () => window.clearTimeout(id);
  }, [mood]);

  const rects = useMemo(() => runs(FRAMES[frame]), [frame]);
  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={size} height={(size * HEIGHT) / WIDTH} shapeRendering="crispEdges"
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={className}>
      {rects.map((r) => <rect key={`${r.y}-${r.x}`} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />)}
    </svg>
  );
}
