import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Customized,
} from "recharts";

export interface AltPoint {
  t: number;
  reported: number;
  projected: number;
}

const DIVERGE_THRESHOLD = 800;

/**
 * Custom layer that paints a diagonal-striped polygon between the
 * "reported" and "projected" line series, but only across segments where
 * |reported - projected| > DIVERGE_THRESHOLD.
 */
function DivergenceStripes(props: unknown) {
  const p = props as {
    formattedGraphicalItems?: Array<{
      props: { dataKey: string };
      item?: { props: { dataKey?: string } };
      // recharts internal: points contain {x, y, value, payload}
      // typed loosely on purpose
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props_points?: Array<{ x: number; y: number }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [k: string]: any;
    }>;
  };

  const items = p.formattedGraphicalItems ?? [];
  const reported = items.find((it) => it.item?.props.dataKey === "reported");
  const projected = items.find((it) => it.item?.props.dataKey === "projected");
  if (!reported || !projected) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rPts = (reported as any).props.points as Array<{ x: number; y: number; payload: AltPoint }> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pPts = (projected as any).props.points as Array<{ x: number; y: number; payload: AltPoint }> | undefined;
  if (!rPts || !pPts || rPts.length !== pPts.length || rPts.length < 2) return null;

  // Build contiguous diverging segments
  const segments: Array<Array<number>> = [];
  let cur: number[] = [];
  for (let i = 0; i < rPts.length; i++) {
    const d = Math.abs(rPts[i].payload.reported - rPts[i].payload.projected);
    if (d > DIVERGE_THRESHOLD) {
      cur.push(i);
    } else if (cur.length) {
      segments.push(cur);
      cur = [];
    }
  }
  if (cur.length) segments.push(cur);

  return (
    <g>
      <defs>
        <pattern
          id="diverge-stripes"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="6" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#FFB020" strokeWidth="1.6" strokeOpacity="0.45" />
        </pattern>
      </defs>
      {segments.map((seg, i) => {
        if (seg.length < 2) return null;
        const top: string[] = [];
        const bottom: string[] = [];
        seg.forEach((idx) => {
          const r = rPts[idx];
          const pj = pPts[idx];
          const high = r.y < pj.y ? r : pj; // smaller y is visually higher
          const low = r.y < pj.y ? pj : r;
          top.push(`${high.x},${high.y}`);
          bottom.unshift(`${low.x},${low.y}`);
        });
        const points = [...top, ...bottom].join(" ");
        return (
          <polygon
            key={i}
            points={points}
            fill="url(#diverge-stripes)"
            stroke="#FFB020"
            strokeOpacity="0.35"
            strokeWidth="0.5"
          />
        );
      })}
    </g>
  );
}

export function AltitudeChart({ data, callsign }: { data: AltPoint[]; callsign: string }) {
  return (
    <div className="h-[180px] w-full">
      <div className="mb-2 flex items-center justify-between text-[10px] tracking-[0.2em] text-[#5A6478]">
        <span className="font-mono-data text-[#00E5FF]/70">ALT PROFILE // {callsign}</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1.5 text-[#00E5FF]">
            <span className="h-[2px] w-4 bg-[#00E5FF]" />
            REPORTED
          </span>
          <span className="flex items-center gap-1.5 text-[#6B7280]">
            <span className="flex h-[2px] w-4 items-center gap-[2px]">
              <span className="h-[2px] w-[3px] bg-[#6B7280]" />
              <span className="h-[2px] w-[3px] bg-[#6B7280]" />
              <span className="h-[2px] w-[3px] bg-[#6B7280]" />
            </span>
            PROJECTED
          </span>
        </span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 5, right: 4, left: -28, bottom: 0 }}>
          <XAxis dataKey="t" hide />
          <YAxis
            tick={{ fill: "#5A6478", fontSize: 9, fontFamily: "JetBrains Mono" }}
            domain={["dataMin - 1000", "dataMax + 1000"]}
            width={50}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#0B0E14",
              border: "1px solid #1F2A3A",
              fontSize: 11,
              fontFamily: "JetBrains Mono",
              borderRadius: 2,
            }}
            labelStyle={{ color: "#00E5FF" }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString("en-GB")}
            formatter={(v) => [`${Math.round(Number(v))} ft`]}
          />
          <Customized component={DivergenceStripes as never} />
          <Line
            type="monotone"
            dataKey="projected"
            stroke="#6B7280"
            strokeWidth={1.25}
            strokeDasharray="2 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="reported"
            stroke="#00E5FF"
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
