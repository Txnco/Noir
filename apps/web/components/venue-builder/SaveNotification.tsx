'use client';

import React, { useEffect, useState } from 'react';
import { Check, AlertTriangle, Loader2 } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'autosaving' | 'autosaved' | 'error';

interface SaveNotificationProps {
  status: SaveStatus;
  onDismiss: () => void;
}

export function SaveNotification({ status, onDismiss }: SaveNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status !== 'idle') {
      setVisible(true);
    }
    if (status === 'saved' || status === 'autosaved') {
      const t = setTimeout(() => {
        setVisible(false);
        setTimeout(onDismiss, 300);
      }, status === 'saved' ? 3000 : 2000);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss]);

  if (!visible) return null;

  const config = {
    saving:    { bg: 'bg-[#EAF0F5]', text: 'text-[#456981]', icon: <Loader2 size={14} className="animate-spin" />, msg: 'Saving...' },
    saved:     { bg: 'bg-green-50',   text: 'text-green-700', icon: <Check size={14} />, msg: `Saved ${new Date().toLocaleTimeString('hr', { hour: '2-digit', minute: '2-digit' })}` },
    autosaving:{ bg: 'bg-[#EAF0F5]', text: 'text-[#456981]', icon: <Loader2 size={14} className="animate-spin" />, msg: 'Autosaving...' },
    autosaved: { bg: 'bg-green-50',   text: 'text-green-700', icon: <Check size={14} />, msg: 'Autosaved' },
    error:     { bg: 'bg-red-50',     text: 'text-red-700',   icon: <AlertTriangle size={14} />, msg: 'Save failed' },
    idle:      { bg: '', text: '', icon: null, msg: '' },
  }[status];

  return (
    <div
      className={`fixed top-16 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium shadow-md transition-all ${config.bg} ${config.text} ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}
      style={{ borderColor: 'transparent' }}
    >
      {config.icon}
      <span>{config.msg}</span>
      {status === 'error' && (
        <button onClick={() => { setVisible(false); onDismiss(); }} className="ml-1 hover:opacity-70">×</button>
      )}
    </div>
  );
}
