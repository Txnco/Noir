'use client';

import React, { useState } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';

const STEPS = [
  {
    title: 'Welcome to NOIR Venue Builder',
    body: 'Create your venue floor plan in a few steps. Everything runs in the browser — no backend needed.',
    icon: '🏗',
    cta: 'Let\'s start →',
  },
  {
    title: 'Tools are on the left',
    body: 'Select a drawing tool to create sections, place seats or tables, and add static objects like a stage or bar. Hover any button for a description.',
    icon: '👈',
    cta: 'Next →',
  },
  {
    title: 'Draw, place, configure',
    body: '1. Draw a section (S) — define a zone\n2. Place seats/tables inside\n3. Click an element to edit it\n4. Save with Ctrl+S when done',
    icon: '🎨',
    cta: 'Close & start',
  },
];

export function OnboardingOverlay() {
  const store = useBuilderStore();
  const [step, setStep] = useState(0);

  function close() {
    localStorage.setItem('noir-builder-onboarding', 'done');
    store.setShowOnboarding(false);
  }

  function next() {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      close();
    }
  }

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="text-5xl mb-4">{current.icon}</div>
        <h2 className="text-lg font-semibold text-[#2C3840] mb-3">{current.title}</h2>
        <p className="text-sm text-[#6B8FA3] leading-relaxed whitespace-pre-line mb-6">
          {current.body}
        </p>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-[#456981]' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full py-3 text-sm font-medium bg-[#456981] text-white rounded-xl hover:bg-[#3D4F59] transition-colors"
        >
          {current.cta}
        </button>

        <button
          onClick={close}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
