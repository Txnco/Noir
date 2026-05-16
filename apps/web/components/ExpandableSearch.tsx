"use client";

import { useState, useEffect, useRef } from "react";

interface ExpandableSearchProps {
  value: string;
  onChange: (val: string) => void;
  onIsOpenChange?: (open: boolean) => void;
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" className="shrink-0 text-text-muted">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 14l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ExpandableSearch({
  value,
  onChange,
  onIsOpenChange,
}: ExpandableSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function setOpen(v: boolean) {
    setIsOpen(v);
    onIsOpenChange?.(v);
  }

  // Collapse when value is cleared externally (e.g. resetFilters)
  useEffect(() => {
    if (value === "") setOpen(false);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘K / Ctrl+K — internal listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function open() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onChange("");
      setOpen(false);
    }
  }

  function handleBlur() {
    if (value === "") setOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        aria-label="Otvori pretragu (⌘K)"
        className="flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface"
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-accent/40 bg-surface-white px-4 py-2 shadow-sm">
      <SearchIcon />
      <input
        ref={inputRef}
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="Pretraži..."
        className="w-44 bg-transparent text-sm text-neutral placeholder:text-text-muted focus:outline-none"
      />
      <button
        onMouseDown={(e) => {
          // mousedown before blur — prevents blur handler from collapsing first
          e.preventDefault();
          onChange("");
          setOpen(false);
        }}
        aria-label="Zatvori pretragu"
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:text-primary"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
