import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DATA_CODE_DICTIONARY } from './fieldCatalog';

export type CodeAutocompleteScope = 'all' | 'document' | 'signature';

interface CodeOptionItem {
  key: string;
  desc: string;
  group: string;
}

interface ActiveTokenMatch {
  query: string;
  replaceStart: number;
  replaceEnd: number;
}

const SCOPE_GROUPS: Record<CodeAutocompleteScope, readonly string[]> = {
  all: ['সাধারণ কোড', 'প্রশিক্ষণার্থী', 'BRN / NID যাচাই', 'হাজিরা', 'স্বাক্ষর'],
  document: ['সাধারণ কোড', 'স্বাক্ষর'],
  signature: ['স্বাক্ষর', 'সাধারণ কোড'],
};

function getOptionsForScope(scope: CodeAutocompleteScope): CodeOptionItem[] {
  const order = SCOPE_GROUPS[scope];
  const out: CodeOptionItem[] = [];
  for (const groupName of order) {
    const grp = DATA_CODE_DICTIONARY.find((g) => g.group === groupName);
    if (!grp) continue;
    for (const item of grp.items) {
      out.push({
        key: item.key,
        desc: item.desc,
        group: grp.group,
      });
    }
  }
  return out;
}

/**
 * Finds an active `{{ ...` or `{{ ... }}` token under the current cursor position.
 */
function detectActiveToken(value: string, cursorPos: number): ActiveTokenMatch | null {
  if (cursorPos < 0 || cursorPos > value.length) return null;

  const before = value.slice(0, cursorPos);
  const openIdx = before.lastIndexOf('{{');
  if (openIdx === -1) return null;

  const between = before.slice(openIdx + 2);
  // Abort if another closing brace, opening brace, or newline exists before cursor
  if (between.includes('}}') || between.includes('{') || between.includes('\n')) {
    return null;
  }
  if (between.length > 40) return null;

  const after = value.slice(cursorPos);
  const closeMatch = after.match(/^[\w\u0980-\u09FF\s-]*\}\}/);
  const replaceEnd = closeMatch ? cursorPos + closeMatch[0].length : cursorPos;

  return {
    query: between.trim(),
    replaceStart: openIdx,
    replaceEnd,
  };
}

export interface CodeAutocompleteFieldProps {
  id?: string;
  value: string;
  onChangeValue: (next: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  multiline?: boolean;
  rows?: number;
  scope?: CodeAutocompleteScope;
}

export const CodeAutocompleteField: React.FC<CodeAutocompleteFieldProps> = ({
  id,
  value,
  onChangeValue,
  onFocus,
  placeholder,
  maxLength,
  className = '',
  multiline = false,
  rows = 2,
  scope = 'document',
}) => {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingSelectionRef = useRef<number | null>(null);

  const [cursorPos, setCursorPos] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [dismissedAtOpenIdx, setDismissedAtOpenIdx] = useState<number | null>(null);
  const [highlightedIdx, setHighlightedIdx] = useState(0);

  const scopedOptions = useMemo(() => getOptionsForScope(scope), [scope]);

  const activeMatch = useMemo(() => {
    if (!isFocused || cursorPos === null) return null;
    return detectActiveToken(value, cursorPos);
  }, [isFocused, cursorPos, value]);

  const filteredOptions = useMemo(() => {
    if (!activeMatch) return [];
    const q = activeMatch.query.toLowerCase();
    if (!q) return scopedOptions;
    return scopedOptions.filter(
      (opt) =>
        opt.key.toLowerCase().includes(q) ||
        opt.desc.toLowerCase().includes(q) ||
        opt.group.toLowerCase().includes(q)
    );
  }, [activeMatch, scopedOptions]);

  const isOpen =
    Boolean(activeMatch) &&
    dismissedAtOpenIdx !== activeMatch?.replaceStart;

  useEffect(() => {
    setHighlightedIdx(0);
  }, [activeMatch?.query, activeMatch?.replaceStart, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    optionRefs.current[highlightedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIdx, isOpen]);

  // Apply deferred cursor placement after React commits updated value
  useLayoutEffect(() => {
    if (pendingSelectionRef.current === null) return;
    const targetPos = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      try {
        el.setSelectionRange(targetPos, targetPos);
      } catch {
        // Ignore if input type does not support selection range
      }
    }
  }, [value]);

  // Close on outside click/touch
  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, [isOpen]);

  const syncCursorFromEl = (el: HTMLInputElement | HTMLTextAreaElement) => {
    const pos = el.selectionStart ?? el.value.length;
    setCursorPos(pos);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const el = e.target;
    let nextVal = el.value;
    let nextCursor = el.selectionStart ?? nextVal.length;
    const isInsertion = nextVal.length > value.length;

    // 1. Auto-close `{{` -> `{{  }}` with cursor placed between the two spaces
    if (
      isInsertion &&
      nextCursor >= 2 &&
      nextVal.slice(nextCursor - 2, nextCursor) === '{{' &&
      nextVal.slice(nextCursor - 3, nextCursor) !== '{{{' &&
      !/^\s*\}\}/.test(nextVal.slice(nextCursor))
    ) {
      const expanded =
        nextVal.slice(0, nextCursor) + '  }}' + nextVal.slice(nextCursor);
      if (!maxLength || expanded.length <= maxLength) {
        nextVal = expanded;
        nextCursor = nextCursor + 1; // Inside `{{ | }}`
        pendingSelectionRef.current = nextCursor;
      }
    }

    setDismissedAtOpenIdx(null);
    setIsFocused(true);
    setCursorPos(nextCursor);
    onChangeValue(nextVal);
  };

  const handleSelectOption = (codeKey: string) => {
    if (!activeMatch) return;
    const inserted = `{{${codeKey}}}`;
    const candidate =
      value.slice(0, activeMatch.replaceStart) +
      inserted +
      value.slice(activeMatch.replaceEnd);

    const nextVal =
      maxLength && candidate.length > maxLength
        ? candidate.slice(0, maxLength)
        : candidate;
    const nextPos = Math.min(
      nextVal.length,
      activeMatch.replaceStart + inserted.length
    );

    pendingSelectionRef.current = nextPos;
    setDismissedAtOpenIdx(null);
    setCursorPos(nextPos);
    onChangeValue(nextVal);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(nextPos, nextPos);
        } catch {
          // Ignore
        }
      }
    });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!isOpen || !activeMatch) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setDismissedAtOpenIdx(activeMatch.replaceStart);
      return;
    }

    if (filteredOptions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx(
        (prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const chosen = filteredOptions[highlightedIdx] || filteredOptions[0];
      if (chosen) {
        handleSelectOption(chosen.key);
      }
    }
  };

  const handleFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setIsFocused(true);
    syncCursorFromEl(e.currentTarget);
    onFocus?.();
  };

  const handleBlur = () => {
    // Allow mousedown-prevented clicks inside dropdown to resolve cleanly
    window.setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        setIsFocused(false);
      }
    }, 120);
  };

  const handleSelectOrKeyUp = (
    e:
      | React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>
      | React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    syncCursorFromEl(e.currentTarget);
  };

  const sharedProps = {
    id,
    value,
    maxLength,
    placeholder,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onKeyUp: handleSelectOrKeyUp,
    onClick: handleSelectOrKeyUp,
    role: 'combobox' as const,
    'aria-expanded': isOpen,
    'aria-controls': isOpen ? listboxId : undefined,
    'aria-autocomplete': 'list' as const,
    autoComplete: 'off',
    className,
  };

  return (
    <div ref={containerRef} className="relative">
      {multiline ? (
        <textarea
          ref={(node) => {
            inputRef.current = node;
          }}
          rows={rows}
          {...sharedProps}
        />
      ) : (
        <input
          ref={(node) => {
            inputRef.current = node;
          }}
          type="text"
          {...sharedProps}
        />
      )}

      {isOpen && activeMatch && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="ডাটা কোড সাজেশন"
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-[12px] border border-theme-border bg-theme-surface shadow-xl overflow-hidden"
        >
          <div className="px-3 py-1.5 bg-theme-surface-subtle border-b border-theme-border flex items-center justify-between gap-2 text-[11px] text-theme-text-secondary">
            <span>
              ডাটা কোড নির্বাচন করুন
              {activeMatch.query ? ` — "${activeMatch.query}"` : ''}
            </span>
            <span className="hidden sm:inline text-[10px]">
              ↑↓ / Enter / Esc
            </span>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-theme-text-secondary text-center">
              &quot;{activeMatch.query}&quot; এর সাথে কোনো কোড মেলেনি
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-theme-border/60">
              {filteredOptions.map((opt, idx) => {
                const isActive = idx === highlightedIdx;
                return (
                  <button
                    key={opt.key}
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlightedIdx(idx)}
                    onClick={() => handleSelectOption(opt.key)}
                    className={`w-full min-h-[44px] px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      isActive
                        ? 'bg-theme-primary-soft text-theme-text-primary'
                        : 'bg-theme-surface hover:bg-theme-surface-hover text-theme-text-primary'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono text-xs font-semibold text-theme-primary">
                          {`{{${opt.key}}}`}
                        </code>
                        <span className="text-xs text-theme-text-primary truncate">
                          {opt.desc}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-[10.5px] text-theme-text-secondary">
                      {opt.group}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
