/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';

import { useLocation } from 'react-router-dom';
import { useTerminal } from '../context/TerminalContext';
import { 
  Clipboard, 
  Mail, 
  Trash2, 
  User, 
  Truck, 
  Clock, 
  CheckCircle2,
  Maximize2,
  X,
  FileText,
  Phone,
  Radio,
  Shield,
  Users,
  Zap,
  Activity,
  Calendar,
  Globe,
  UserCheck,
  Lock,
  AlertCircle,
  ArrowRight,
  EyeOff,
  Eye,
  MapPin,
  Video,
  FileSpreadsheet,
  AlertTriangle,
  ExternalLink,
  Timer
} from 'lucide-react';
import { ThemeSelectorButton } from '../components/centralhub/ThemeSelector';
import { Modal } from '../components/centralhub/Modal';
import { 
  TEAM_MEMBERS, 
  SHIFT_TEAMS,
  ALSSUP_OPTIONS, 
  DEFAULT_ZULU_OPTIONS, 
  MEDSUP_MAP, 
  BASE_REPORT_EMAILS, 
  CC_EMAIL, 
  SHIFTS,
  INITIAL_DATA,
  ShiftReportData 
} from '../lib/shiftConstants';
import { 
  doc, 
  onSnapshot, 
  db, 
  PersonnelMember 
} from '../lib/firebase';
import { 
  LabelStyleConfig, 
  DEFAULT_LABEL_STYLE, 
  getSavedLabelStyle 
} from '../lib/labelStyle';

const STORAGE_KEY = "shiftReportDraft_v2";

const LabelStyleContext = React.createContext<LabelStyleConfig>(DEFAULT_LABEL_STYLE);

export function useLabelStyle() {
  return React.useContext(LabelStyleContext);
}

export default function ShiftReport({ isModal, onClose }: { isModal?: boolean; onClose?: () => void } = {}) {
  const [data, setData] = useState<ShiftReportData>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...INITIAL_DATA, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_DATA;
  });

  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [showLinksModal, setShowLinksModal] = useState(false);

  
  // Custom Box Prompt Label Color & Size Configuration synced with ThemeSelectorModal
  const [labelStyle, setLabelStyle] = useState<LabelStyleConfig>(getSavedLabelStyle);

  const parseTime = (timeStr: string) => {
    if (!timeStr) return null;
    const [h, m, s = 0] = timeStr.split(':').map(Number);
    return (h * 3600) + (m * 60) + s;
  };

  const getDiff = (d: { code: string, units: string }) => {
    const codeTime = parseTime(d.code);
    const unitsTime = parseTime(d.units);
    if (codeTime === null || unitsTime === null) return null;
    let diff = unitsTime - codeTime;
    if (diff < 0) diff += 24 * 3600;
    return diff;
  };

  const getFrDiff = (d: { unitsAdded: string, callDrop: string }) => {
    const time1 = parseTime(d.unitsAdded);
    const time2 = parseTime(d.callDrop);
    if (time1 === null || time2 === null) return null;
    let diff = time2 - time1;
    if (diff < 0) diff += 24 * 3600;
    return diff;
  };

  const formatSecs = (s: number | null) => {
    if (s === null) return '--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}m ${sec}s`;
  };

  const diff1 = getDiff(data.dispatch1 || INITIAL_DATA.dispatch1);
  const diff2 = getDiff(data.dispatch2 || INITIAL_DATA.dispatch2);
  
  let averageDiff: number | null = null;
  if (diff1 !== null && diff2 !== null) {
    averageDiff = (diff1 + diff2) / 2;
  } else if (diff1 !== null) {
    averageDiff = diff1;
  } else if (diff2 !== null) {
    averageDiff = diff2;
  }

  const frDiff1 = getFrDiff(data.fr911_1 || INITIAL_DATA.fr911_1);
  const frDiff2 = getFrDiff(data.fr911_2 || INITIAL_DATA.fr911_2);
  
  let frAverageDiff: number | null = null;
  if (frDiff1 !== null && frDiff2 !== null) {
    frAverageDiff = (frDiff1 + frDiff2) / 2;
  } else if (frDiff1 !== null) {
    frAverageDiff = frDiff1;
  } else if (frDiff2 !== null) {
    frAverageDiff = frDiff2;
  }

  useEffect(() => {
    const handleStyleUpdate = (e: any) => {
      if (e?.detail) {
        setLabelStyle(e.detail);
      } else {
        setLabelStyle(getSavedLabelStyle());
      }
    };
    window.addEventListener('shift_report_label_style_changed', handleStyleUpdate);
    window.addEventListener('storage', handleStyleUpdate);
    return () => {
      window.removeEventListener('shift_report_label_style_changed', handleStyleUpdate);
      window.removeEventListener('storage', handleStyleUpdate);
    };
  }, []);
  
  // Standalone detection
  const isStandalone = true;

  const { terminalUser } = useTerminal();
  const [personnel, setPersonnel] = useState<PersonnelMember[]>([]);
  const [zuluList, setZuluList] = useState<string[]>(DEFAULT_ZULU_OPTIONS);
  
  // Sync with Firestore Global Settings (Personnel, Zulu, Supervisors)
  useEffect(() => {
    try {
      const cached = localStorage.getItem('cached_global_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.zuluOptions) setZuluList(parsed.zuluOptions);
        if (parsed.alssupOptions) setAlssupList(parsed.alssupOptions);
      }
    } catch (e) {}

    const settingsRef = doc(db, 'settings', 'global');
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const d = snapshot.data();
        if (d.personnel) setPersonnel(d.personnel);
        if (d.supervisors) setSupervisors(d.supervisors);
        if (d.alssupOptions) setAlssupList(d.alssupOptions);
        if (d.zuluOptions) setZuluList(d.zuluOptions);
      }
    });

    return () => unsubscribe();
  }, []);

  // Compute shift teams from personnel with robust static fallbacks
  const shiftTeams = useMemo(() => {
    const teams: Record<string, { lead: string; members: string[] }> = {
      'A': { lead: '', members: [] },
      'B': { lead: '', members: [] },
      'C': { lead: '', members: [] },
      'D': { lead: '', members: [] },
      'Other': { lead: '', members: [] }
    };

    if (personnel && personnel.length > 0) {
      personnel.forEach(p => {
        let targetKey: string = p.shift;
        if (targetKey === 'Alpha' || targetKey === 'A-Shift' || targetKey === 'A') targetKey = 'A';
        else if (targetKey === 'Bravo' || targetKey === 'B-Shift' || targetKey === 'B') targetKey = 'B';
        else if (targetKey === 'Charlie' || targetKey === 'C-Shift' || targetKey === 'C') targetKey = 'C';
        else if (targetKey === 'Delta' || targetKey === 'D-Shift' || targetKey === 'D') targetKey = 'D';
        else targetKey = 'Other';

        const expectedLead = targetKey === 'A' ? SHIFT_TEAMS['Alpha']?.lead :
                             targetKey === 'B' ? SHIFT_TEAMS['Bravo']?.lead :
                             targetKey === 'C' ? SHIFT_TEAMS['Charlie']?.lead :
                             targetKey === 'D' ? SHIFT_TEAMS['Delta']?.lead : '';

        const isLead = p.role?.toLowerCase().includes('lead') || 
                       p.role?.toLowerCase().includes('supervisor') ||
                       p.name === expectedLead;

        if (isLead && !teams[targetKey].lead) {
          teams[targetKey].lead = p.name;
        } else {
          teams[targetKey].members.push(p.name);
        }
      });
    } else {
      if (SHIFT_TEAMS['Alpha']) teams['A'] = { lead: SHIFT_TEAMS['Alpha'].lead, members: SHIFT_TEAMS['Alpha'].members };
      if (SHIFT_TEAMS['Bravo']) teams['B'] = { lead: SHIFT_TEAMS['Bravo'].lead, members: SHIFT_TEAMS['Bravo'].members };
      if (SHIFT_TEAMS['Charlie']) teams['C'] = { lead: SHIFT_TEAMS['Charlie'].lead, members: SHIFT_TEAMS['Charlie'].members };
      if (SHIFT_TEAMS['Delta']) teams['D'] = { lead: SHIFT_TEAMS['Delta'].lead, members: SHIFT_TEAMS['Delta'].members };
    }

    return teams;
  }, [personnel]);

  // Dynamic Data State
  const [supervisors, setSupervisors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("shiftReport_supervisors");
    return saved ? JSON.parse(saved) : MEDSUP_MAP;
  });
  
  const [alssupList, setAlssupList] = useState<string[]>(() => {
    const saved = localStorage.getItem("shiftReport_alssup");
    return saved ? JSON.parse(saved) : ALSSUP_OPTIONS;
  });

  useEffect(() => {
    localStorage.setItem("shiftReport_supervisors", JSON.stringify(supervisors));
  }, [supervisors]);

  useEffect(() => {
    localStorage.setItem("shiftReport_alssup", JSON.stringify(alssupList));
  }, [alssupList]);

  // Auto-save logic to local buffer
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (e) {
        console.error(e);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [data]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'name' && value) {
        for (const [shiftKey, team] of Object.entries(shiftTeams)) {
          if (team.lead === value || team.members.includes(value)) {
            updated.shift = shiftKey as any;
            break;
          }
        }
      }
      return updated;
    });
  };

  const handleTextareaTab = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      
      const nextValue = value.substring(0, start) + "    " + value.substring(end);
      const name = target.name;
      
      const event = {
        target: {
          name,
          value: nextValue
        }
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      handleChange(event);
      
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const clearData = () => {
    if (window.confirm("Are you sure you want to clear all form data?")) {
      setData(INITIAL_DATA);
      localStorage.removeItem(STORAGE_KEY);
      setShowToast("Form buffer cleared");
    }
  };

  
  
  const stripHtml = (html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  };

  const formatDateForDisplay = (dStr: string) => {
    if (!dStr) return "N/A";
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
    return dStr;
  };

  const alignTabularReport = (text: string) => {
    if (!text) return text;
    // Normalize Unicode non-breaking spaces (\u00a0) and tabs
    const rawLines = text.split(/\r?\n/).map(l => l.replace(/\u00a0/g, ' ').trim()).filter(Boolean);
    if (rawLines.length === 0) return text;

    const rows: string[][] = [];

    for (const raw of rawLines) {
      if (/^unit\b/i.test(raw)) {
        rows.push(["Unit", "Date", "Time", "Call-Sign", "10-42"]);
        continue;
      }

      let line = raw;

      // 1. Repair broken split prefixes: "MED-    0" -> "MED-0", "ALS-    02" -> "ALS-02"
      line = line.replace(/\b(MED|ALS|QRV|RESCUE)-?\s+(\d+)\b/gi, "$1-$2");
      // 2. Repair split numbers in units: "MED1    2" -> "MED12", "MED1    3" -> "MED13", "MED1    20" -> "MED120"
      line = line.replace(/\bMED1\s+(\d+)\b/gi, "MED1$1");
      // 3. Repair fused "MED12010/2" -> "MED120 10/2"
      line = line.replace(/\b(MED\d+|ALS-\d+|A-\d+)(0?[1-9]|1[0-2])\/(\d{1,2})\b/gi, "$1 $2/$3");
      // 4. Repair fractured times: "6       :54" -> "6:54", "7:      10" -> "7:10", "6:4     3" -> "6:43"
      line = line.replace(/(\d{1,2})\s*:\s*(\d{2})/g, "$1:$2");
      line = line.replace(/(\d{1,2}):(\d)\s+(\d)/g, "$1:$2$3");
      // 5. Repair split name initials: "T.    HORNSBY" -> "T. HORNSBY", "I.    SETTLES" -> "I. SETTLES"
      line = line.replace(/\b([A-Z]\.)\s+([A-Z]+)\b/g, "$1 $2");
      // 6. Repair split EMS signs: "EMS    -28" -> "EMS-28"
      line = line.replace(/\b(EMS)\s+-?(\d+)\b/g, "$1-$2");

      // Extract Unit (first non-whitespace token)
      const unitMatch = line.match(/^(\S+)/);
      if (!unitMatch) {
        rows.push([line]);
        continue;
      }
      const unit = unitMatch[1];
      let rest = line.slice(unit.length).trim();

      // Extract Date (\d{1,2}\/\d{1,2})
      const dateMatch = rest.match(/^(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
      if (!dateMatch) {
        const fallbackCells = line.split(/\s{2,}|\t/).map(s => s.trim()).filter(Boolean);
        rows.push(fallbackCells);
        continue;
      }
      const date = dateMatch[1];
      rest = rest.slice(date.length).trim();

      // Extract Time (\d{1,2}:\d{2})
      const timeMatch = rest.match(/^(\d{1,2}:\d{2})/);
      if (!timeMatch) {
        rows.push([unit, date, rest]);
        continue;
      }
      const time = timeMatch[1];
      rest = rest.slice(time.length).trim();

      // In the rest of the string, fix fractured call-signs like "C-1    0" -> "C-10", "A-1    2" -> "A-12"
      // ensuring the trailing digit is NOT followed by a colon
      rest = rest.replace(/\b([A-Z])-(\d)\s+(\d+)(?!:)\b/g, "$1-$2$3");

      // Extract 10-42 Time (at end) and Call-Sign (in middle)
      const end1042Match = rest.match(/(?:^|\s+)(\d{1,2}:\d{2})$/);
      let time1042 = "";
      let callSign = "";

      if (end1042Match) {
        time1042 = end1042Match[1];
        callSign = rest.slice(0, rest.length - end1042Match[0].length).trim();
      } else {
        if (/^\d{1,2}:\d{2}$/.test(rest.trim())) {
          time1042 = rest.trim();
          callSign = "";
        } else {
          callSign = rest.trim();
        }
      }

      rows.push([unit, date, time, callSign, time1042]);
    }

    if (rows.length < 2) return text;

    // Calculate maximum column widths
    const maxCols = Math.max(...rows.map(r => r.length));
    const colWidths = Array(maxCols).fill(0);
    rows.forEach(row => {
      row.forEach((cell, i) => {
        if (cell.length > colWidths[i]) colWidths[i] = cell.length;
      });
    });

    return rows.map(row => {
      return row.map((cell, i) => {
        if (i === row.length - 1) return cell;
        return cell.padEnd(colWidths[i] + 4, " ");
      }).join("").trimEnd();
    }).join('\n');
  };

  const buildReport = () => {
    const reportParts: string[] = [];

    const formatTabularData = (text: string) => alignTabularReport(text);

    const addSection = (title: string, content: string | string[], isTabular: boolean = false) => {
      const header = `**${title}**`;
      reportParts.push(header);
      
      if (Array.isArray(content)) {
        content.forEach(line => reportParts.push(line));
      } else {
        let text = (typeof content === 'string' ? content.trim() : "");
        if (isTabular && text) {
          text = formatTabularData(text);
        }
        reportParts.push(text || "None");
      }
      reportParts.push(""); // spacer
    };

    addSection("Info", [
      `Name: ${data.name || "N/A"}`,
      `Date: ${formatDateForDisplay(data.date)}`,
      `Shift: ${data.shift}`
    ]);

    addSection("Radio Assignments", [
      `Ch.1: ${data.channel1 || "N/A"}`,
      `Ch.2: ${data.channel2 || "N/A"}`,
      `Third Person: ${data.thirdPerson || "N/A"}`
    ]);

    addSection("Supervisors", [
      `ALSSUP: ${data.alssup || "N/A"}`,
      `MEDSUP: ${data.medsup || "N/A"}`
    ]);

    addSection("Zulu On Call (After 1700)", [
      `Primary: ${data.zuluPrimary || "N/A"}`,
      `Secondary: ${data.zuluSecondary || "N/A"}`
    ]);

    addSection("Avail Trucks", [
      `911 Trucks: ${data.truck911 || "0"}`,
      `GT Trucks: ${data.truckGT || "0"}`,
      `ALS Transport Trucks: ${data.truckALS || "None"}`,
      `County QRV: ${data.truckCountyQRV || "None"}`
    ]);

    addSection("Late Trucks", data.lateTrucks);
    addSection("Out of Chute", data.outOfChute);
    addSection("Other Issues", data.issues);

    if (data.pasteNotes) {
      addSection("Roster/Time Up", data.pasteNotes, true);
    }

    if (data.otherEvents) {
      addSection("Other Events", data.otherEvents);
    }

    const formatTimeRow = (label: string, cfs: string, t1: string, t2: string, diff: string) => {
      if (!cfs && !t1 && !t2) return null;
      return `${label} - CFS: ${cfs || 'N/A'} | Times: ${t1 || '--'} to ${t2 || '--'} | Diff: ${diff}`;
    };

    const dispatch1 = data.dispatch1 || INITIAL_DATA.dispatch1;
    const dispatch2 = data.dispatch2 || INITIAL_DATA.dispatch2;
    const fr911_1 = data.fr911_1 || INITIAL_DATA.fr911_1;
    const fr911_2 = data.fr911_2 || INITIAL_DATA.fr911_2;

    const dispatchLines = [
      formatTimeRow("Check 1", dispatch1.cfs, dispatch1.code, dispatch1.units, formatSecs(diff1)),
      formatTimeRow("Check 2", dispatch2.cfs, dispatch2.code, dispatch2.units, formatSecs(diff2))
    ].filter(Boolean) as string[];

    if (dispatchLines.length > 0) {
      dispatchLines.push(`Average Difference: ${formatSecs(averageDiff)}`);
      addSection("Random Dispatch Time Checks", dispatchLines);
    }

    const fr911Lines = [
      formatTimeRow("FR911 1", fr911_1.cfs, fr911_1.unitsAdded, fr911_1.callDrop, formatSecs(frDiff1)),
      formatTimeRow("FR911 2", fr911_2.cfs, fr911_2.unitsAdded, fr911_2.callDrop, formatSecs(frDiff2))
    ].filter(Boolean) as string[];

    if (fr911Lines.length > 0) {
      fr911Lines.push(`Average Difference: ${formatSecs(frAverageDiff)}`);
      addSection("FR911 Times", fr911Lines);
    }

    return reportParts.join("\n");
  };



  const copyReportToClipboard = async (plainReport: string) => {
    let copied = false;

    // Primary: Async Clipboard API with text/plain only
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({
          "text/plain": new Blob([plainReport], { type: "text/plain" })
        });
        await navigator.clipboard.write([item]);
        copied = true;
      }
    } catch (e) {
      console.warn("Async Clipboard API error, attempting fallback:", e);
    }

    // Fallback: execCommand copy
    if (!copied) {
      try {
        const copyHandler = (e: ClipboardEvent) => {
          e.preventDefault();
          if (e.clipboardData) {
            e.clipboardData.setData('text/plain', plainReport);
          }
        };
        document.addEventListener('copy', copyHandler);
        copied = document.execCommand('copy');
        document.removeEventListener('copy', copyHandler);
      } catch (e) {
        console.warn("execCommand copy error:", e);
      }
    }

    // Ultimate Fallback: writeText
    if (!copied) {
      try {
        await navigator.clipboard.writeText(plainReport);
        copied = true;
      } catch (e) {}
    }

    return copied;
  };

  const handleSend = async () => {
    const plainReport = buildReport();

    try {
      await copyReportToClipboard(plainReport);
      setShowToast("Report Copied to Clipboard! Launching Email...");
    } catch (err) {
      console.error("Clipboard error:", err);
      setShowToast("Launching email...");
    }

    const reportSubjectType = data.reportType || "Mid-Shift Report";
    const reportDate = data.date ? formatDateForDisplay(data.date) : format(new Date(), 'MM/dd/yyyy');
    const subject = `${reportSubjectType} ${reportDate}`;
    const body = `*** FULL REPORT COPIED TO CLIPBOARD ***\n\nSummary:\n- Supervisor: ${data.name}\n- Date: ${formatDateForDisplay(data.date)}\n\nClick here and press Ctrl+V to paste the detailed report.`;
    
    let cc = CC_EMAIL;
    const medSupEmail = data.medsup ? supervisors[data.medsup] : null;
    if (medSupEmail && medSupEmail.trim()) {
      cc += `; ${medSupEmail}`;
    }

    const mailto = `mailto:${encodeURIComponent(BASE_REPORT_EMAILS)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  return (
    <div className="relative selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-opacity duration-1000">
        <div className="absolute top-[10%] left-[10%] w-[50%] h-[50%] bg-white/[0.015] blur-[140px] rounded-full" />
        <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] bg-white/[0.01] blur-[140px] rounded-full" />
      </div>

      <div className="relative z-10">
        <LabelStyleContext.Provider value={labelStyle}>
          <main className="max-w-[1700px] mx-auto p-4 sm:p-8 lg:p-12 space-y-10">
            {/* Header Module */}
            <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/30 border border-indigo-400/30 relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                    <Clipboard className="w-7 h-7 text-white relative z-10" />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white uppercase italic leading-tight">
                      Shift <span className="text-indigo-500 not-italic">Report</span>
                    </h1>
                    <p className="text-slate-400 text-[10px] uppercase tracking-[0.35em] font-black flex items-center gap-2.5">
                      <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
                      Operational Roster & Tactical Shift Matrix
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                 <div className="flex items-center gap-4 px-4 py-2 bg-black/40 border border-white/10 rounded-2xl shadow-inner">
                   <div className="flex flex-col items-center">
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Active Roster</span>
                     <span className="text-xs font-black text-indigo-400 uppercase italic">SHIFT-{data.shift}</span>
                   </div>
                   <div className="w-px h-5 bg-white/10" />
                   <div className="flex flex-col items-center">
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Buffer State</span>
                     <span className="text-[10px] font-mono font-bold text-emerald-400 animate-pulse">ACTIVE</span>
                   </div>
                 </div>
                 
                 {/* Themes & Typography Button */}
                 <ThemeSelectorButton />

                 <button
                   type="button"
                   onClick={() => setShowLinksModal(true)}
                   className="tactical-btn-indigo px-5 py-2.5 text-[10px] shadow-indigo-600/20 cursor-pointer"
                   title="View Important Links"
                 >
                   <Globe className="w-3.5 h-3.5" />
                   Links
                 </button>

              </div>
            </header>

            <div className="flex flex-col gap-8 sm:gap-10">
              {/* Row 1: Info, Radio, Supervisors */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="tactical-card p-6 sm:p-8 space-y-6 sm:space-y-8 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <User className="w-3.5 h-3.5" /> Shift Information
                     </h2>
                  </div>
                  <div className="space-y-5">
                    <Field label="Name" icon={UserCheck}>
                      <select name="name" value={data.name} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {Object.entries(shiftTeams).map(([shiftName, team]) => (
                          <optgroup key={shiftName} label={`${shiftName} Shift`} className="bg-[#030712] text-indigo-400 font-bold">
                            {team.lead && <option value={team.lead} className="bg-[#0b0f17] text-white">{team.lead} (Lead)</option>}
                            {team.members.map(m => (
                              <option key={m} value={m} className="bg-[#0b0f17] text-white">{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                    <Field label="Date" icon={Calendar}>
                      <input type="date" name="date" value={data.date} onChange={handleChange} />
                    </Field>
                    <Field label="Shift" icon={Activity}>
                      <select name="shift" value={data.shift} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        {SHIFTS.map(s => <option key={s} value={s} className="bg-[#0b0f17] text-white">{s}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="tactical-card p-6 sm:p-8 space-y-6 sm:space-y-8 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Zap className="w-3.5 h-3.5" /> Radio Assignments
                     </h2>
                  </div>
                  <div className="space-y-5">
                    <Field label="Radio Ch. 1" icon={Radio}>
                      <select name="channel1" value={data.channel1} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {Object.entries(shiftTeams).map(([shiftName, team]) => (
                          <optgroup key={shiftName} label={`${shiftName} Shift`} className="bg-[#030712] text-indigo-400 font-bold">
                            {team.lead && <option value={team.lead} className="bg-[#0b0f17] text-white">{team.lead}</option>}
                            {team.members.map(m => (
                              <option key={m} value={m} className="bg-[#0b0f17] text-white">{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                    <Field label="Radio Ch. 2" icon={Shield}>
                      <select name="channel2" value={data.channel2} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {Object.entries(shiftTeams).map(([shiftName, team]) => (
                          <optgroup key={shiftName} label={`${shiftName} Shift`} className="bg-[#030712] text-indigo-400 font-bold">
                            {team.lead && <option value={team.lead} className="bg-[#0b0f17] text-white">{team.lead}</option>}
                            {team.members.map(m => (
                              <option key={m} value={m} className="bg-[#0b0f17] text-white">{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                    <Field label="Third Person" icon={Users}>
                      <select name="thirdPerson" value={data.thirdPerson} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {Object.entries(shiftTeams).map(([shiftName, team]) => (
                          <optgroup key={shiftName} label={`${shiftName} Shift`} className="bg-[#030712] text-indigo-400 font-bold">
                            {team.lead && <option value={team.lead} className="bg-[#0b0f17] text-white">{team.lead}</option>}
                            {team.members.map(m => (
                              <option key={m} value={m} className="bg-[#0b0f17] text-white">{m}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>

                <div className="tactical-card p-6 sm:p-8 space-y-6 sm:space-y-8 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Lock className="w-3.5 h-3.5" /> Supervisors
                     </h2>
                  </div>
                  <div className="space-y-5">
                    <Field label="ALSSUP" icon={Activity}>
                      <select name="alssup" value={data.alssup} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {alssupList.map(a => <option key={a} value={a} className="bg-[#0b0f17] text-white">{a}</option>)}
                      </select>
                    </Field>
                    <Field label="MEDSUP" icon={Globe}>
                      <select name="medsup" value={data.medsup} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {Object.keys(supervisors).map(m => <option key={m} value={m} className="bg-[#0b0f17] text-white">{m}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* Row 2: Zulu On Call & Available Trucks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <div className="tactical-card p-6 sm:p-8 space-y-6 sm:space-y-8 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Truck className="w-3.5 h-3.5" /> Available Trucks & Zulu On Call
                     </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field label="911 Trucks" icon={Activity}>
                      <input type="number" name="truck911" value={data.truck911} onChange={handleChange} min="0" />
                    </Field>
                    <Field label="GT Trucks" icon={Activity}>
                      <input type="number" name="truckGT" value={data.truckGT} onChange={handleChange} min="0" />
                    </Field>
                    <Field label="Zulu Primary" icon={Zap}>
                      <select name="zuluPrimary" value={data.zuluPrimary} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {data.zuluPrimary && !zuluList.includes(data.zuluPrimary) && (
                          <option value={data.zuluPrimary} className="bg-[#0b0f17] text-white">{data.zuluPrimary}</option>
                        )}
                        {zuluList.map(z => <option key={z} value={z} className="bg-[#0b0f17] text-white">{z}</option>)}
                      </select>
                    </Field>
                    <Field label="Zulu Secondary" icon={Zap}>
                      <select name="zuluSecondary" value={data.zuluSecondary} onChange={handleChange} className="bg-[#0b0f17] text-white cursor-pointer">
                        <option value="" className="bg-[#0b0f17] text-slate-400">-- SELECT --</option>
                        {data.zuluSecondary && !zuluList.includes(data.zuluSecondary) && (
                          <option value={data.zuluSecondary} className="bg-[#0b0f17] text-white">{data.zuluSecondary}</option>
                        )}
                        {zuluList.map(z => <option key={z} value={z} className="bg-[#0b0f17] text-white">{z}</option>)}
                      </select>
                    </Field>
                    <Field label="ALS Transport" icon={Shield}>
                      <input type="text" name="truckALS" value={data.truckALS} onChange={handleChange} placeholder="UNIT_IDS" />
                    </Field>
                    <Field label="County QRV" icon={Activity}>
                      <input type="text" name="truckCountyQRV" value={data.truckCountyQRV} onChange={handleChange} placeholder="UNIT_ID" />
                    </Field>
                  </div>
                </div>

                <div className="tactical-card p-6 sm:p-8 space-y-6 sm:space-y-8 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Clock className="w-3.5 h-3.5" /> Late Trucks & Chute Deviations
                     </h2>
                  </div>
                  <div className="space-y-5">
                    <div className="flex flex-col gap-2.5 group/field">
                      <div className="flex items-center gap-2 pl-3">
                        <AlertCircle style={{ color: labelStyle.color }} className="w-3.5 h-3.5 opacity-80 shrink-0" />
                        <label 
                          style={{ 
                            color: labelStyle.color, 
                            fontSize: `${labelStyle.fontSize}px` 
                          }}
                          className={`${labelStyle.fontWeight} ${labelStyle.textTransform} tracking-wider transition-all select-none leading-none`}
                        >
                          Late Trucks
                        </label>
                      </div>
                      <textarea 
                        name="lateTrucks" 
                        value={data.lateTrucks} 
                        onChange={handleChange} 
                        onKeyDown={handleTextareaTab}
                        rows={3} 
                        className="w-full tactical-input p-4 text-xs font-mono text-white"
                        placeholder="UNIT / TIME / REASON..." 
                      />
                    </div>
                    <div className="flex flex-col gap-2.5 group/field">
                      <div className="flex items-center gap-2 pl-3">
                        <Zap style={{ color: labelStyle.color }} className="w-3.5 h-3.5 opacity-80 shrink-0" />
                        <label 
                          style={{ 
                            color: labelStyle.color, 
                            fontSize: `${labelStyle.fontSize}px` 
                          }}
                          className={`${labelStyle.fontWeight} ${labelStyle.textTransform} tracking-wider transition-all select-none leading-none`}
                        >
                          Out of Chute
                        </label>
                      </div>
                      <textarea 
                        name="outOfChute" 
                        value={data.outOfChute} 
                        onChange={handleChange} 
                        onKeyDown={handleTextareaTab}
                        rows={3} 
                        className="w-full tactical-input p-4 text-xs font-mono text-white"
                        placeholder="CHUTE ANOMALIES & EXPLANATIONS..." 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Operational Log & Buffer Sync */}
              {terminalUser?.role?.toLowerCase() !== 'dispatcher' ? (
                <section className="tactical-card p-6 sm:p-8 space-y-6 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <FileText className="w-4 h-4" /> Operational Log & Other Issues
                     </h2>
                     <div className="flex items-center gap-4">
                       <div className="w-24 h-[1px] bg-gradient-to-r from-indigo-500/30 to-transparent" />
                     </div>
                  </div>
                  <textarea 
                    name="issues"
                    value={data.issues} 
                    onChange={handleChange}
                    onKeyDown={handleTextareaTab}
                    rows={6}
                    className="w-full bg-[#0b0f17]/50 rounded border border-white/10 p-4 text-sm font-sans text-white focus:outline-none focus:border-indigo-500/50 resize-y"
                    placeholder="ENTER OTHER ISSUES..."
                  />
                  <div className="pt-4 mt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <label 
                        style={{ 
                          color: labelStyle.color, 
                          fontSize: `${Math.max(8, labelStyle.fontSize - 1)}px` 
                        }}
                        className={`${labelStyle.fontWeight} ${labelStyle.textTransform} tracking-wider select-none transition-all`}
                      >
                        Buffer Data / Roster Sync Notes (Auto-Aligned Table)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (!data.pasteNotes) return;
                          const aligned = alignTabularReport(data.pasteNotes);
                          setData(p => ({ ...p, pasteNotes: aligned }));
                          setShowToast("Roster table columns aligned cleanly!");
                        }}
                        className="px-3 py-1 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 text-indigo-300 text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow active:scale-95 flex items-center gap-1.5"
                        title="Re-align columns into clean fixed-width rows"
                      >
                        <span>⚡ Align Columns</span>
                      </button>
                    </div>
                    <textarea 
                      name="pasteNotes"
                      value={data.pasteNotes} 
                      onChange={handleChange} 
                      onKeyDown={handleTextareaTab}
                      onBlur={() => {
                        // Automatically align when user clicks or tabs out if it looks like a table
                        if (data.pasteNotes && /unit/i.test(data.pasteNotes) && /time/i.test(data.pasteNotes)) {
                          const aligned = alignTabularReport(data.pasteNotes);
                          if (aligned !== data.pasteNotes) {
                            setData(p => ({ ...p, pasteNotes: aligned }));
                          }
                        }
                      }}
                      rows={8}
                      className="w-full bg-[#0b0f17]/80 rounded border border-white/15 p-4 text-xs font-mono text-emerald-300 focus:outline-none focus:border-indigo-500/50 resize-y whitespace-pre overflow-x-auto leading-relaxed shadow-inner"
                      placeholder="Paste Roster / Time Up table here (columns will stay aligned in monospaced grid)..."
                    />
                  </div>
                </section>
              ) : (
                <section className="tactical-card p-12 flex flex-col items-center justify-center text-center gap-6 border-white/10 bg-white/[0.02]">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                    <EyeOff className="w-8 h-8 text-indigo-500 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Access Restricted</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black leading-relaxed max-w-sm">
                      The operational log is reserved for shift supervisors and administrative nodes.
                    </p>
                  </div>
                </section>
              )}

              {/* Dispatch & FR911 Time Checks */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                <section className="tactical-card p-4 sm:p-6 space-y-4 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Clock className="w-4 h-4" /> Random Dispatch Time Checks
                     </h2>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { state: data.dispatch1 || INITIAL_DATA.dispatch1, setter: (val: any) => setData(p => ({ ...p, dispatch1: val })), diff: diff1 },
                      { state: data.dispatch2 || INITIAL_DATA.dispatch2, setter: (val: any) => setData(p => ({ ...p, dispatch2: val })), diff: diff2 }
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded border border-white/10 bg-[#0b0f17]/50 flex flex-wrap gap-3 items-end"
                      >
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">CFS Number</label>
                          <input 
                            type="text" 
                            value={item.state.cfs} 
                            onChange={e => item.setter({ ...item.state, cfs: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">Code Added</label>
                          <input 
                            type="time" 
                            step="1"
                            value={item.state.code} 
                            onChange={e => item.setter({ ...item.state, code: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">Units Added</label>
                          <input 
                            type="time" 
                            step="1"
                            value={item.state.units} 
                            onChange={e => item.setter({ ...item.state, units: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">Difference</label>
                          <div className="px-2 py-1.5 font-bold text-base text-indigo-400">
                            {formatSecs(item.diff)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="p-3 rounded border border-white/10 bg-black/40 flex justify-end items-center gap-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Average:</div>
                      <div className="text-lg font-black text-indigo-400">
                        {formatSecs(averageDiff)}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="tactical-card p-4 sm:p-6 space-y-4 group">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                     <h2 
                       style={{ color: labelStyle.color }}
                       className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 transition-colors"
                     >
                        <Clock className="w-4 h-4" /> FR911 Times
                     </h2>
                  </div>
                  
                  <div className="space-y-4">
                    {[
                      { state: data.fr911_1 || INITIAL_DATA.fr911_1, setter: (val: any) => setData(p => ({ ...p, fr911_1: val })), diff: frDiff1 },
                      { state: data.fr911_2 || INITIAL_DATA.fr911_2, setter: (val: any) => setData(p => ({ ...p, fr911_2: val })), diff: frDiff2 }
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-3 rounded border border-white/10 bg-[#0b0f17]/50 flex flex-wrap gap-3 items-end"
                      >
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">CFS Number</label>
                          <input 
                            type="text" 
                            value={item.state.cfs} 
                            onChange={e => item.setter({ ...item.state, cfs: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">Units Added</label>
                          <input 
                            type="time" 
                            step="1"
                            value={item.state.unitsAdded} 
                            onChange={e => item.setter({ ...item.state, unitsAdded: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">FR911 Call Drop</label>
                          <input 
                            type="time" 
                            step="1"
                            value={item.state.callDrop} 
                            onChange={e => item.setter({ ...item.state, callDrop: e.target.value })} 
                            className="w-full tactical-input p-2 text-xs font-mono text-white bg-[#0b0f17]"
                          />
                        </div>
                        <div className="flex flex-col min-w-[80px]">
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1">Difference</label>
                          <div className="px-2 py-1.5 font-bold text-base text-indigo-400">
                            {formatSecs(item.diff)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="p-3 rounded border border-white/10 bg-black/40 flex justify-end items-center gap-4">
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Average:</div>
                      <div className="text-lg font-black text-indigo-400">
                        {formatSecs(frAverageDiff)}
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Actions Footer Bar */}
              <div className="tactical-card p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
                 <div className="absolute inset-0 bg-indigo-500/[0.02] pointer-events-none" />
                 <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.25em] relative z-10">
                   <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
                   Autosave Buffer Active {lastSaved ? `at ${lastSaved}` : 'now'}
                 </div>
                 <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 relative z-10 w-full md:w-auto">
                   <button 
                     type="button" 
                     onClick={clearData}
                     className="px-4 py-2.5 text-[10px] font-black text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all uppercase tracking-[0.2em] rounded-xl cursor-pointer"
                   >
                     Clear Buffer
                   </button>
                   <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 h-[48px] shadow-inner">
                     <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                     <select 
                       name="reportType" 
                       value={data.reportType || "Mid-Shift Report"} 
                       onChange={handleChange}
                       className="bg-transparent border-none text-xs font-black uppercase text-white outline-none cursor-pointer pr-2"
                     >
                       <option value="Mid-Shift Report" className="bg-slate-900">Mid-Shift Report</option>
                       <option value="End of Shift Report" className="bg-slate-900">End Of Shift Report</option>
                     </select>
                   </div>

                   <button 
                     type="button"
                     onClick={handleSend}
                     className="px-8 h-[48px] bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 active:scale-95 flex items-center justify-center gap-3 cursor-pointer whitespace-nowrap border border-indigo-400/30 select-none"
                     title="Deploy Report & Launch Email"
                   >
                     <Mail className="w-4 h-4 text-white shrink-0" />
                     <span>Deploy Report</span>
                   </button>
                 </div>
              </div>
            </div>
          </main>
        </LabelStyleContext.Provider>
      </div>

      {/* Floating Toast Notification */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 glass-effect !bg-slate-950/90 border border-indigo-500/30 text-white font-bold rounded-3xl shadow-2xl flex items-center gap-4 animate-bounce">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-sm tracking-tight">{showToast}</span>
        </div>
      )}

      {/* Links Modal */}
      <Modal
        isOpen={showLinksModal}
        onClose={() => setShowLinksModal(false)}
        title="Important Operations Links"
        subtitle="Tactical & Dispatch Resource Directory"
        icon={<Globe className="w-5 h-5 text-emerald-400" />}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ExternalLinkItem 
              href="#/timers" 
              label="Incident Timers" 
              meta="20m / 30m Visual Watch" 
              icon={Timer}
              isInternal={true}
            />
            <ExternalLinkItem 
              href="https://distancechecker.sndjy.us/" 
              label="Distance Checker" 
              meta="Distance To Call" 
              icon={MapPin}
            />
            <ExternalLinkItem 
              href="https://dotcamera.sndjy.us/" 
              label="DOT Cameras" 
              meta="DOT Highway Cameras" 
              icon={Video}
            />
            <ExternalLinkItem 
              href="https://drive.google.com/drive/folders/1pe1rJBNOYTTFuPa0yk3TMCnWd7v0pZ_W?usp=sharing" 
              label="Shift Report" 
              meta="Google Sheets Archive" 
              icon={FileSpreadsheet}
            />
            <ExternalLinkItem 
              href="https://priorityambulance-my.sharepoint.com/:x:/g/personal/jsanders_medshore_com/IQB5-AkCs8b6TazKysmNYYE9AT53juYy9or_8_XJYYTCZNQ?e=KHSLnvhttpsAFFdocs.google.comFspreadsheetsFdF1gNp6K6y-nKFmrdt6BxvId68WqCh2MCWqE6irUOpWJDoFeditFgidD496939607#gidD496939607" 
              label="Issue Tracker" 
              meta="Priority Incident Log" 
              icon={AlertTriangle}
            />
            <ExternalLinkItem 
              href="https://scheduling.esosuite.net/Login.aspx?db=priorityambulance" 
              label="ESO Scheduling" 
              meta="ESO Crew Portal" 
              icon={Calendar}
            />
            <ExternalLinkItem 
              href="https://docs.google.com/spreadsheets/d/1-4Uwh00g4orCaOQoOrLIcRkamAhdxrBNhVVOt2IEOoY/edit?gid=534085027#gid=534085027" 
              label="Truck Up Times" 
              meta="Fleet Status Sheet" 
              icon={Truck}
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button 
              type="button"
              onClick={() => setShowLinksModal(false)}
              className="px-8 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest text-xs transition-all border border-white/20 cursor-pointer shadow-lg active:scale-95"
            >
              Close Window
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Field({ label, children, icon: Icon }: { label: string; children: React.ReactElement; icon?: React.ElementType }) {
  const { color, fontSize, fontWeight, textTransform } = useLabelStyle();

  return (
    <div className="flex flex-col gap-2 group/field">
      <div className="flex items-center gap-2 pl-2">
        {Icon && (
          <Icon 
            style={{ color: color }} 
            className="w-3.5 h-3.5 opacity-80 group-hover/field:opacity-100 transition-opacity shrink-0" 
          />
        )}
        <label 
          style={{ 
            color: color, 
            fontSize: `${fontSize}px` 
          }}
          className={`${fontWeight} ${textTransform} tracking-wider transition-all select-none leading-none`}
        >
          {label}
        </label>
      </div>
      <div className="relative group">
        {React.cloneElement(children as React.ReactElement<any>, {
          className: `w-full tactical-input p-3.5 text-xs font-mono relative z-10 text-white bg-[#0b0f17] ${children.type === 'select' ? 'cursor-pointer' : ''} ${(children as any).props?.className || ''}`
        })}
        <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/[0.02] transition-colors pointer-events-none rounded-xl" />
      </div>
    </div>
  );
}

function ExternalLinkItem({ 
  href, 
  label, 
  meta, 
  icon: Icon,
  isInternal = false
}: { 
  href: string; 
  label: string; 
  meta: string; 
  icon?: React.ElementType;
  isInternal?: boolean;
}) {
  return (
    <a 
      href={href} 
      target={isInternal ? "_self" : "_blank"} 
      rel={isInternal ? undefined : "noopener noreferrer"}
      className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md border border-white/10 hover:border-emerald-400/40 group transition-all duration-200 flex flex-col justify-between gap-3 shadow-md hover:shadow-xl hover:shadow-black/50 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-300 transition-colors shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <span className="text-xs font-black tracking-wider uppercase text-slate-200 group-hover:text-white transition-colors">
            {label}
          </span>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all shrink-0" />
      </div>
      <span className="text-[9px] font-mono font-bold text-slate-400 group-hover:text-slate-300 uppercase tracking-widest block pl-0.5 relative z-10">
        {meta}
      </span>
      {/* Subtle hover gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-emerald-500/[0.05] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </a>
  );
}
