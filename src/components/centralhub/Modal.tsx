import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
  fullWidth?: boolean;
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle = 'Operations_Modal_Subsystem',
  icon, 
  children, 
  maxWidth = 'max-w-4xl', 
  fullWidth = false 
}: ModalProps) {
  const actualMaxWidth = fullWidth ? 'max-w-[95vw]' : maxWidth;
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 backdrop-blur-xl bg-black/65">
          {/* Backdrop click to dismiss */}
          <div 
            onClick={onClose} 
            className="absolute inset-0 cursor-pointer" 
            aria-label="Close modal overlay"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`bg-bg-surface/85 backdrop-blur-2xl border border-white/15 rounded-[2.5rem] w-full ${actualMaxWidth} max-h-[92vh] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1.5px_rgba(255,255,255,0.28)] flex flex-col overflow-hidden relative z-10`}
          >
            {/* Ambient Glass Reflections */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] via-white/[0.01] to-black/20 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/8 via-transparent to-emerald-500/6 pointer-events-none" />
            
            {/* Header */}
            <div className="px-6 py-5 sm:px-8 sm:py-6 border-b border-white/10 bg-white/[0.03] backdrop-blur-md flex items-center justify-between relative z-10 shrink-0">
              <div className="flex items-center gap-3.5 sm:gap-4">
                {icon && (
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-md shadow-indigo-950/40 shrink-0">
                    {icon}
                  </div>
                )}
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight italic leading-tight">
                    {title}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 opacity-75">
                    {subtitle}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10 hover:border-white/20 active:scale-95 cursor-pointer shrink-0 shadow-sm"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar relative z-10">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

