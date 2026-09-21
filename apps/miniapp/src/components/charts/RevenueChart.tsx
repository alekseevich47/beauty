import { useEffect, useRef } from 'react';
import uPlot from 'uplot';

type Point = { t: string; v: number };

type Props = {
  series: Point[];
  className?: string;
};

export function RevenueChart({ series, className = '' }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || series.length === 0) return;

    const xs = series.map((_, i) => i);
    const ys = series.map((p) => p.v);
    const width = el.clientWidth || 220;
    const height = 72;

    const opts: uPlot.Options = {
      width,
      height,
      legend: { show: false },
      cursor: { show: false },
      axes: [{ show: false }, { show: false }],
      scales: { x: { time: false } },
      series: [
        {},
        {
          stroke: '#e8a87c',
          width: 2,
          fill: (u) => {
            const ctx = u.ctx;
            const g = ctx.createLinearGradient(0, 0, 0, height);
            g.addColorStop(0, 'rgba(232,168,124,0.35)');
            g.addColorStop(1, 'rgba(232,168,124,0)');
            return g;
          },
        },
      ],
      hooks: {
        init: [
          (u) => {
            u.root.style.pointerEvents = 'none';
          },
        ],
      },
    };

    plotRef.current?.destroy();
    plotRef.current = new uPlot(opts, [xs, ys], el);

    const onResize = () => {
      if (!plotRef.current || !rootRef.current) return;
      plotRef.current.setSize({
        width: rootRef.current.clientWidth || 220,
        height,
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [series]);

  return <div ref={rootRef} className={`h-[72px] w-full ${className}`} />;
}
