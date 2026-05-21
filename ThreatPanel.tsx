// dashboard/src/components/ThreatPanel.tsx
'use client';

import { WebSocketMessage } from '@/hooks/useWebSockets';
import { AlertTriangle, ShieldAlert, Activity } from 'lucide-react';

interface ThreatPanelProps {
  alerts: WebSocketMessage[];
}

export default function ThreatPanel({ alerts }: ThreatPanelProps) {
  return (
    <div className="bg-gray-900 border border-red-900/50 rounded-xl p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-800">
        <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
          <ShieldAlert size={20} />
          MITRE ATT&CK Threat Feed
        </h2>
        <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-xs font-mono">
          {alerts.length} ACTIVE
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {alerts.length === 0 ? (
          <div className="text-gray-500 text-center py-10 flex flex-col items-center gap-2">
            <Activity size={32} className="opacity-50" />
            <p>No active threats detected.</p>
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div 
              key={`${alert.icao24}-${idx}`} 
              className={`p-3 rounded-lg border ${
                alert.analysis.assessment.severity === 'CRITICAL' 
                  ? 'bg-red-950/30 border-red-800/50' 
                  : 'bg-yellow-950/30 border-yellow-800/50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-mono font-bold text-gray-200">
                  {alert.icao24} {alert.packet.callsign ? `(${alert.packet.callsign})` : ''}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                  alert.analysis.assessment.severity === 'CRITICAL' ? 'bg-red-500 text-black' : 'bg-yellow-500 text-black'
                }`}>
                  {alert.analysis.assessment.severity}
                </span>
              </div>
              
              <p className="text-sm text-gray-300 mb-2">
                {alert.analysis.assessment.description}
              </p>
              
              {alert.analysis.assessment.mitre_technique && (
                <div className="flex items-center gap-1 mt-2 text-xs text-red-400 font-mono">
                  <AlertTriangle size={12} />
                  {alert.analysis.assessment.mitre_technique}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
