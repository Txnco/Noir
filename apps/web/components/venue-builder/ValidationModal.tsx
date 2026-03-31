'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import type { BuilderState } from '../../types/venueBuilder';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateState(state: Pick<BuilderState, 'sections' | 'items' | 'venue_name'>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (state.sections.length === 0) {
    errors.push('Add at least one section before saving.');
  }

  for (const s of state.sections) {
    if (!s.label.trim()) {
      errors.push(`Section without a name found (id: ${s.id}).`);
    }
    if (s.is_numbered && state.items.filter((i) => i.section_id === s.id).length === 0) {
      errors.push(`Section "${s.label}" is numbered but has no items.`);
    }
  }

  if (!state.venue_name.trim()) {
    warnings.push('Venue has no name — users won\'t be able to identify it.');
  }

  for (const s of state.sections) {
    if (s.capacity === 0 && !s.is_numbered) {
      warnings.push(`Section "${s.label}" has capacity 0.`);
    }
  }

  const floatingItems = state.items.filter((i) => !i.section_id);
  if (floatingItems.length > 0) {
    warnings.push(`${floatingItems.length} item(s) are outside any section.`);
  }

  return { errors, warnings };
}

interface ValidationModalProps {
  result: ValidationResult;
  onClose: () => void;
  onSaveAnyway: () => void;
}

export function ValidationModal({ result, onClose, onSaveAnyway }: ValidationModalProps) {
  const hasErrors = result.errors.length > 0;

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            {hasErrors ? (
              <AlertCircle size={20} className="text-red-600" />
            ) : (
              <AlertTriangle size={20} className="text-amber-600" />
            )}
            <h2 className={`text-base font-semibold ${hasErrors ? 'text-red-600' : 'text-amber-600'}`}>
              {hasErrors ? 'Cannot save — fix errors first' : 'Warnings before saving'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        {result.errors.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-red-700 mb-2">Errors (must fix):</p>
            <ul className="space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⛔</span> {e}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.warnings.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-amber-700 mb-2">Warnings (optional):</p>
            <ul className="space-y-1">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠</span> {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium bg-[#456981] text-white rounded-lg hover:bg-[#3D4F59] transition-colors"
          >
            {hasErrors ? 'Fix issues' : 'Go back'}
          </button>
          {!hasErrors && (
            <button
              onClick={onSaveAnyway}
              className="flex-1 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-[#2C3840]"
            >
              Save anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
