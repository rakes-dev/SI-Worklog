"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

export interface SuggestionItem {
  label: string;
  value: string;
  sublabel?: string;
}

interface SuggestionContextType {
  activeFieldId: string | null;
  suggestions: SuggestionItem[];
  showSuggestions: (
    fieldId: string,
    items: SuggestionItem[],
    onSelect: (val: string) => void,
  ) => void;
  hideSuggestions: (fieldId?: string) => void;
  onSelectCallback: ((val: string) => void) | null;
}

const SuggestionContext = createContext<SuggestionContextType>({
  activeFieldId: null,
  suggestions: [],
  showSuggestions: () => {},
  hideSuggestions: () => {},
  onSelectCallback: null,
});

export function SuggestionProvider({ children }: { children: React.ReactNode }) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [onSelectCallback, setOnSelectCallback] = useState<
    ((val: string) => void) | null
  >(null);

  const showSuggestions = useCallback(
    (
      fieldId: string,
      items: SuggestionItem[],
      onSelect: (val: string) => void,
    ) => {
      setActiveFieldId(fieldId);
      setSuggestions(items);
      setOnSelectCallback(() => onSelect);
    },
    [],
  );

  const hideSuggestions = useCallback((fieldId?: string) => {
    setActiveFieldId((prev) => {
      if (!fieldId || prev === fieldId) {
        setSuggestions([]);
        setOnSelectCallback(null);
        return null;
      }
      return prev;
    });
  }, []);

  return (
    <SuggestionContext.Provider
      value={{
        activeFieldId,
        suggestions,
        showSuggestions,
        hideSuggestions,
        onSelectCallback,
      }}
    >
      {children}
      {activeFieldId && suggestions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl p-2 flex items-center gap-2 overflow-x-auto scrollbar-none animate-in slide-in-from-bottom-2 duration-150">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground shrink-0 px-1">
            Suggestions:
          </span>
          {suggestions.map((item, idx) => (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur & keep keyboard open
                if (onSelectCallback) onSelectCallback(item.value);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                if (onSelectCallback) onSelectCallback(item.value);
              }}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 shrink-0 hover:bg-primary/20 transition-all scale-press flex items-center gap-1.5 shadow-sm"
            >
              <span>{item.label}</span>
              {item.sublabel && (
                <span className="text-[10px] text-muted-foreground opacity-80 font-normal">
                  ({item.sublabel})
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </SuggestionContext.Provider>
  );
}

export function useSuggestions() {
  return useContext(SuggestionContext);
}
