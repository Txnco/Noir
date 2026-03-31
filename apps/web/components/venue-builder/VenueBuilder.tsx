'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useBuilderStore } from '../../store/venueBuilderStore';
import { TopBar } from './TopBar';
import { LeftToolbar } from './LeftToolbar';
import { Canvas } from './Canvas';
import { RightPanel } from './RightPanel';
import { OnboardingOverlay } from './OnboardingOverlay';
import { SaveNotification, type SaveStatus } from './SaveNotification';
import { ValidationModal, validateState } from './ValidationModal';
import { useBuilderKeyboard } from '../../hooks/venue-builder/useBuilderKeyboard';
import { useAutosave } from '../../hooks/venue-builder/useAutosave';
import { serializeToJSON } from '../../lib/venue-builder/jsonSerializer';
import { saveVenueJSON, listSavedVenues, loadVenueJSON } from '../../lib/venue-builder/saveToFile';
import { v4 as uuidv4 } from 'uuid';

interface VenueBuilderProps {
  initialVenueId?: string;
}

export function VenueBuilder({ initialVenueId }: VenueBuilderProps) {
  const store = useBuilderStore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showValidation, setShowValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });
  const [savedVenues, setSavedVenues] = useState<string[]>([]);
  const [pendingSaveAnyway, setPendingSaveAnyway] = useState(false);

  // Initialize store on mount
  useEffect(() => {
    const venueId = initialVenueId ?? `venue-${uuidv4().slice(0, 8)}`;

    // Try to load from localStorage backup first
    const backup = localStorage.getItem(`noir-builder-${venueId}-backup`);
    if (backup) {
      try {
        const json = JSON.parse(backup);
        store.loadFromJSON(json);
        store.setVenueMeta(venueId, json.venue_id ?? venueId);
      } catch { /* ignore */ }
    } else if (initialVenueId) {
      loadVenueJSON(initialVenueId).then((json) => {
        if (json) store.loadFromJSON(json);
      });
    } else {
      store.resetStore(venueId, '');
    }

    // Check onboarding
    if (!localStorage.getItem('noir-builder-onboarding')) {
      store.setShowOnboarding(true);
    }

    // Load saved venues list
    listSavedVenues().then(setSavedVenues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVenueId]);

  const doSave = useCallback(async (silent = false) => {
    const { sections, items, statics, venue_id, venue_name, layout_version } = store;

    const result = validateState({ sections, items, venue_name });

    if (!silent) {
      if (result.errors.length > 0 || result.warnings.length > 0) {
        setValidationResult(result);
        setShowValidation(true);
        setPendingSaveAnyway(false);
        return;
      }
    } else {
      if (result.errors.length > 0) return; // Don't autosave with hard errors
    }

    await performSave(silent);
  }, [store]);

  async function performSave(silent: boolean) {
    const { sections, items, statics, venue_id, layout_version } = useBuilderStore.getState();
    setSaveStatus(silent ? 'autosaving' : 'saving');

    try {
      const json = serializeToJSON({ sections, items, statics, venue_id, layout_version });

      // Save to localStorage as backup
      localStorage.setItem(`noir-builder-${venue_id}-backup`, JSON.stringify(json));

      // Save to file via API
      await saveVenueJSON(venue_id, layout_version, json);

      store.markSaved();
      setSaveStatus(silent ? 'autosaved' : 'saved');

      // Refresh venues list
      listSavedVenues().then(setSavedVenues);
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
    }
  }

  function handleSaveAnyway() {
    setShowValidation(false);
    performSave(false);
  }

  async function handleLoadVenue(venueId: string) {
    const json = await loadVenueJSON(venueId);
    if (json) {
      store.loadFromJSON(json);
      store.setVenueMeta(venueId, venueId);
    }
  }

  // Keyboard shortcuts
  useBuilderKeyboard(() => doSave(false));

  // Autosave
  useAutosave(doSave);

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ background: '#F5F4F0' }}>
      <TopBar
        onSave={() => doSave(false)}
        saveStatus={saveStatus}
        savedVenues={savedVenues}
        onLoadVenue={handleLoadVenue}
      />
      <LeftToolbar />
      <Canvas />
      <RightPanel />

      <SaveNotification
        status={saveStatus}
        onDismiss={() => setSaveStatus('idle')}
      />

      {showValidation && (
        <ValidationModal
          result={validationResult}
          onClose={() => setShowValidation(false)}
          onSaveAnyway={handleSaveAnyway}
        />
      )}

      {store.showOnboarding && <OnboardingOverlay />}
    </div>
  );
}
