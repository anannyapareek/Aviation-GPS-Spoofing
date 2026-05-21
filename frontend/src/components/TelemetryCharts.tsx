// dashboard/src/components/TelemetryCharts.tsx
'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { WebSocketMessage } from '@/hooks/useWebSockets';

interface TelemetryChartsProps {
  aircraft: WebSocketMessage | null;
}

export default function TelemetryCharts({ aircraft }: TelemetryChartsProps) {
  // In a real scenario, we'd store a history array for the selected aircraft.
  // For this demo, we'll generate a trailing 10-tick mock history based on the current packet 
  // to show the recharts capability immediately.
  const chartData = useMemo(() => {
    if (!aircraft) return [];
    
    const data = [];
    const baseTime = aircraft.packet.timestamp;
    const baseSpeed = aircraft.packet.velocity || 250;
    const baseAltB = aircraft.packet.baro_alt || 30000;
    const baseAltG = aircraft.packet.geo_alt || 30000;

    for (let i = 9; i >= 0; i--) {
      data.push({
        time: new Date((baseTime - i * 15) * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
        speed: Math.max(0, baseSpeed + (Math.random() * 20 - 10)),
        baroAlt: baseAltB + (Math.random() * 50 - 25),
        geoAlt: baseAltG + (Math.random() * 100 - 50),
        anomalyScore: (aircraft.analysis?.ml?.score || 0) * 100
      });
    }
    
    // Set the latest point to actual current data
    data[9] = {
      time: new Date(baseTime * 1000).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      speed: aircraft.packet.velocity,
      baroAlt: aircraft.packet.baro_alt,
      geoAlt: aircraft.packet.geo_alt,
      anomalyScore: (aircraft.analysis?.ml?.score || 0) * 100
    };

    return data;
  }, [aircraft]);

  if (!aircraft) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-center h-full text-gray-500">
        Select an aircraft on the map to view telemetry.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-full gap-4 overflow-y-auto custom-scrollbar">
      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Altitude Divergence</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6' }}
              />
              <Line type="monotone" dataKey="baroAlt" name="Barometric" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="geoAlt" name="Geometric" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Anomaly Score Confidence</h3>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#F3F4F6' }} />
              <Area 
                type="monotone" 
                dataKey="anomalyScore" 
                stroke="#EF4444" 
                fill="#7F1D1D" 
                fillOpacity={0.5} 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
