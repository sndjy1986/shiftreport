import React, { useState, useEffect, useRef } from 'react';
import { 
  Timer as TimerIcon, 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  ExternalLink, 
  Maximize2, 
  Volume2, 
  VolumeX,
  Clock,
  Radio,
  Flame,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface DispatchTimer {
  id: string;
  name: string;
  elapsedSeconds: number; // counts up from 0
  isRunning: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'dispatch_incident_timers_v1';
const AUDIO_ALERT_URL = 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3';

export default function Timers() {
  const [timers, setTimers] = useState<DispatchTimer[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load saved timers:', e);
    }
    return [
      {
        id: 'initial-1',
        name: 'MED-12 Call Watch',
        elapsedSeconds: 0,
        isRunning: false,
        createdAt: Date.now()
      }
    ];
  });

  const [newName, setNewName] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alerted20Ref = useRef<Set<string>>(new Set());
  const alerted30Ref = useRef<Set<string>>(new Set());

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } catch (e) {
      console.error('Failed to persist timers:', e);
    }
  }, [timers]);

  // Master 1-second interval loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => prev.map(timer => {
        if (!timer.isRunning) return timer;
        const nextElapsed = timer.elapsedSeconds + 1;

        // Check 20-minute threshold (1200 seconds)
        if (nextElapsed === 1200 && !alerted20Ref.current.has(timer.id)) {
          alerted20Ref.current.add(timer.id);
          playAlertSound();
        }

        // Check 30-minute threshold (1800 seconds)
        if (nextElapsed === 1800 && !alerted30Ref.current.has(timer.id)) {
          alerted30Ref.current.add(timer.id);
          playAlertSound();
        }

        return { ...timer, elapsedSeconds: nextElapsed };
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const playAlertSound = () => {
    if (!audioEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(AUDIO_ALERT_URL);
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  };

  const handleAddTimer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newName.trim() || `Incident ${timers.length + 1}`;
    const newTimer: DispatchTimer = {
      id: `timer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: cleanName,
      elapsedSeconds: 0,
      isRunning: true,
      createdAt: Date.now()
    };
    setTimers(prev => [newTimer, ...prev]);
    setNewName('');
  };

  const toggleTimer = (id: string) => {
    setTimers(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, isRunning: !t.isRunning };
      }
      return t;
    }));
  };

  const resetTimer = (id: string) => {
    alerted20Ref.current.delete(id);
    alerted30Ref.current.delete(id);
    setTimers(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, elapsedSeconds: 0, isRunning: false };
      }
      return t;
    }));
  };

  const deleteTimer = (id: string) => {
    alerted20Ref.current.delete(id);
    alerted30Ref.current.delete(id);
    setTimers(prev => prev.filter(t => t.id !== id));
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const popOutStandalone = () => {
    const standaloneUrl = window.location.href.split('#')[0] + '#/timers';
    window.open(
      standaloneUrl, 
      'Popout_Timers', 
      'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes'
    );
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <style>{`
        @keyframes flash-orange {
          0%, 100% {
            background-color: rgba(249, 115, 22, 0.22);
            border-color: #f97316;
            box-shadow: 0 0 25px rgba(249, 115, 22, 0.65), inset 0 0 15px rgba(249, 115, 22, 0.3);
          }
          50% {
            background-color: rgba(249, 115, 22, 0.05);
            border-color: rgba(249, 115, 22, 0.3);
            box-shadow: none;
          }
        }
        @keyframes flash-red {
          0%, 100% {
            background-color: rgba(239, 68, 68, 0.32);
            border-color: #ef4444;
            box-shadow: 0 0 35px rgba(239, 68, 68, 0.8), inset 0 0 20px rgba(239, 68, 68, 0.4);
          }
          50% {
            background-color: rgba(239, 68, 68, 0.07);
            border-color: rgba(239, 68, 68, 0.3);
            box-shadow: none;
          }
        }
        .timer-flashing-orange {
          animation: flash-orange 1.2s infinite ease-in-out !important;
        }
        .timer-flashing-red {
          animation: flash-red 0.8s infinite ease-in-out !important;
        }
      `}</style>

      {/* Header bar */}
      <header className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 hover:border-white/20 active:scale-95"
            title="Return to Shift Report"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 shadow-lg shadow-orange-500/10">
            <TimerIcon className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
                Dispatch Incident Timers
              </h1>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30">
                Live Watch
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              20m Flash Orange • 30m+ Priority Flash Red • Real-time Monitoring
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border transition-all ${
              audioEnabled 
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25' 
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
            }`}
            title={audioEnabled ? "Alert Sound Enabled" : "Alert Sound Muted"}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{audioEnabled ? 'Audio ON' : 'Audio Muted'}</span>
          </button>

          <button
            type="button"
            onClick={popOutStandalone}
            className="px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition-all shadow-md active:scale-95"
            title="Pop out into an independent dedicated window"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="hidden sm:inline">Pop Out Window</span>
          </button>
        </div>
      </header>

      {/* Create New Timer Form */}
      <section className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-xl">
        <form onSubmit={handleAddTimer} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter Unit or Incident Name (e.g., MED-14, MVC Anderson Hwy, Fire Standby)..."
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/15 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/20 text-white placeholder-slate-500 font-medium text-sm outline-none transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Timer</span>
          </button>
        </form>

        {/* Quick presets */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5 text-xs text-slate-400">
          <span className="font-mono uppercase text-[10px] tracking-wider text-slate-500">Quick Presets:</span>
          {['MED-1', 'MED-2', 'MED-3', 'MED-4', 'MED-12', 'MED-14', 'RESCUE-1', 'STAGING'].map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                const newTimer: DispatchTimer = {
                  id: `timer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  name: `${preset} On Scene`,
                  elapsedSeconds: 0,
                  isRunning: true,
                  createdAt: Date.now()
                };
                setTimers(prev => [newTimer, ...prev]);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 font-mono text-[11px] border border-white/5 hover:border-orange-500/30 transition-all cursor-pointer"
            >
              + {preset}
            </button>
          ))}
        </div>
      </section>

      {/* Active Timers Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Active Timers ({timers.length})
            </h2>
          </div>
          {timers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all active timers?')) {
                  setTimers([]);
                  alerted20Ref.current.clear();
                  alerted30Ref.current.clear();
                }
              }}
              className="text-xs text-slate-500 hover:text-rose-400 transition-colors flex items-center gap-1 font-mono uppercase"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>

        {timers.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center gap-3">
            <TimerIcon className="w-12 h-12 text-slate-600 stroke-[1.5]" />
            <p className="text-slate-400 font-medium text-sm">No active timers running.</p>
            <p className="text-slate-600 text-xs font-mono">Add a timer above to start tracking incident duration.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timers.map((timer) => {
              const minutes = Math.floor(timer.elapsedSeconds / 60);
              const isOver30 = minutes >= 30;
              const isOver20 = minutes >= 20 && !isOver30;

              let cardClasses = 'bg-white/[0.03] border-white/10 hover:border-white/20';
              let badgeText = 'Normal (<20m)';
              let badgeColor = 'bg-slate-500/20 text-slate-300 border-slate-500/30';

              if (isOver30) {
                cardClasses = 'timer-flashing-red';
                badgeText = 'CRITICAL ALERT (30m+)';
                badgeColor = 'bg-rose-500/30 text-rose-200 border-rose-500/50';
              } else if (isOver20) {
                cardClasses = 'timer-flashing-orange';
                badgeText = 'WARNING (20m - 30m)';
                badgeColor = 'bg-orange-500/30 text-orange-200 border-orange-500/50';
              }

              // Progress percentage towards 30 minutes
              const progressPct = Math.min(100, Math.round((timer.elapsedSeconds / 1800) * 100));

              return (
                <div
                  key={timer.id}
                  className={`p-6 rounded-2xl border backdrop-blur-md transition-all duration-300 flex flex-col justify-between gap-5 relative overflow-hidden shadow-lg ${cardClasses}`}
                >
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="min-w-0 flex-1">
                      <span className={`text-[9px] font-mono font-black uppercase tracking-widest px-2 py-0.5 rounded border inline-block mb-1.5 ${badgeColor}`}>
                        {badgeText}
                      </span>
                      <h3 className="text-base font-black text-white uppercase tracking-tight truncate" title={timer.name}>
                        {timer.name}
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteTimer(timer.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete Timer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Big Digital Timer Display */}
                  <div className="flex flex-col items-center justify-center py-2 relative z-10">
                    <span 
                      className={`text-6xl font-black font-mono tracking-tight tabular-nums select-none ${
                        isOver30 
                          ? 'text-rose-400 drop-shadow-[0_0_20px_rgba(244,63,94,0.6)]' 
                          : isOver20 
                          ? 'text-orange-400 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]' 
                          : 'text-white'
                      }`}
                    >
                      {formatTime(timer.elapsedSeconds)}
                    </span>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase mt-1">
                      {timer.isRunning ? 'Active Running' : 'Paused'} • {minutes} Min Elapsed
                    </span>
                  </div>

                  {/* Progress Bar (0 to 30 mins) */}
                  <div className="w-full space-y-1 relative z-10">
                    <div className="flex justify-between text-[9px] font-mono text-slate-400 uppercase">
                      <span>0m</span>
                      <span className={isOver20 ? 'text-orange-400 font-bold' : ''}>20m Warning</span>
                      <span className={isOver30 ? 'text-rose-400 font-bold' : ''}>30m Red</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/5">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          isOver30 
                            ? 'bg-rose-500 shadow-[0_0_10px_#ef4444]' 
                            : isOver20 
                            ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' 
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5 relative z-10">
                    <button
                      type="button"
                      onClick={() => toggleTimer(timer.id)}
                      className={`flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
                        timer.isRunning
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {timer.isRunning ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span>Resume</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => resetTimer(timer.id)}
                      className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer active:scale-95"
                      title="Reset to 00:00"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Fast Test Skip Buttons */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1">
                    <span>Fast Jump:</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, elapsedSeconds: 1195, isRunning: true } : t));
                        }}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-orange-500/20 text-slate-400 hover:text-orange-300 transition-colors"
                        title="Jump to 19m 55s to watch 20m Orange Flash"
                      >
                        19m55s (Test 20m)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTimers(prev => prev.map(t => t.id === timer.id ? { ...t, elapsedSeconds: 1795, isRunning: true } : t));
                        }}
                        className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors"
                        title="Jump to 29m 55s to watch 30m Red Flash"
                      >
                        29m55s (Test 30m)
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
