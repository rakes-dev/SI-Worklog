"use client";

import React, { useEffect, useState } from "react";

export interface SuggestionItem {
  label: string;
  value: string;
  sublabel?: string;
}

type SuggestionListener = (state: {
  activeFieldId: string | null;
  suggestions: SuggestionItem[];
  onSelectCallback: ((val: string) => void) | null;
}) => void;

let currentState = {
  activeFieldId: null as string | null,
  suggestions: [] as SuggestionItem[],
  onSelectCallback: null as ((val: string) => void) | null,
};

const listeners = new Set<SuggestionListener>();

function notify() {
  listeners.forEach((listener) => listener(currentState));
}

export const suggestionService = {
  showSuggestions(
    fieldId: string,
    items: SuggestionItem[],
    onSelect: (val: string) => void,
  ) {
    currentState = {
      activeFieldId: fieldId,
      suggestions: items,
      onSelectCallback: onSelect,
    };
    notify();
  },

  hideSuggestions(fieldId?: string) {
    if (!fieldId || currentState.activeFieldId === fieldId) {
      currentState = {
        activeFieldId: null,
        suggestions: [],
        onSelectCallback: null,
      };
      notify();
    }
  },
};

export function useSuggestions() {
  return {
    showSuggestions: suggestionService.showSuggestions,
    hideSuggestions: suggestionService.hideSuggestions,
  };
}

export function SuggestionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(currentState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      if (window.visualViewport) {
        const isKeyboardOpen =
          window.visualViewport.height < window.innerHeight * 0.85;
        if (!isKeyboardOpen && currentState.activeFieldId) {
          suggestionService.hideSuggestions();
        }
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      setTimeout(() => {
        const active = document.activeElement;
        const related = e.relatedTarget;
        if (
          (active instanceof HTMLInputElement) ||
          (active instanceof HTMLTextAreaElement) ||
          (active instanceof HTMLSelectElement) ||
          (related instanceof HTMLInputElement) ||
          (related instanceof HTMLTextAreaElement)
        ) {
          return;
        }
        suggestionService.hideSuggestions();
      }, 150);
    };

    window.visualViewport?.addEventListener("resize", handleResize);
    window.addEventListener("resize", handleResize);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return (
    <>
      {children}
      {state.activeFieldId && state.suggestions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border shadow-2xl p-2 flex items-center gap-2 overflow-x-auto scrollbar-none animate-in slide-in-from-bottom-2 duration-150">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground shrink-0 px-1">
            Suggestions:
          </span>
          {state.suggestions.map((item, idx) => (
            <button
              key={`${item.value}-${idx}`}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur & keep keyboard open
                if (state.onSelectCallback) state.onSelectCallback(item.value);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                if (state.onSelectCallback) state.onSelectCallback(item.value);
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
    </>
  );
}
