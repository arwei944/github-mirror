import { useEffect, useRef } from 'react';

function parseKeyCombo(combo) {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  const ctrl = parts.includes('ctrl') || parts.includes('control');
  const meta = parts.includes('meta') || parts.includes('cmd') || parts.includes('command');
  const shift = parts.includes('shift');
  const alt = parts.includes('alt') || parts.includes('option');

  const key = parts.find(
    (p) =>
      !['ctrl', 'control', 'meta', 'cmd', 'command', 'shift', 'alt', 'option'].includes(p)
  );

  return { ctrl, meta, shift, alt, key: key || '' };
}

function isEditableElement(element) {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea') return true;
  if (element.isContentEditable) return true;
  return false;
}

function useKeyboardShortcuts(shortcuts) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isEditableElement(document.activeElement)) {
        return;
      }

      for (const [combo, handler] of Object.entries(shortcutsRef.current)) {
        const parsed = parseKeyCombo(combo);

        const ctrlMatch = parsed.ctrl ? (e.ctrlKey || e.metaKey) : true;
        const metaMatch = parsed.meta ? (e.ctrlKey || e.metaKey) : true;
        const shiftMatch = parsed.shift ? e.shiftKey : true;
        const altMatch = parsed.alt ? e.altKey : true;

        const modifierMatch = ctrlMatch && metaMatch && shiftMatch && altMatch;

        let keyMatch = false;
        if (parsed.key) {
          const targetKey = parsed.key.toLowerCase();
          const pressedKey = e.key.toLowerCase();

          if (targetKey === 'escape' && pressedKey === 'escape') {
            keyMatch = true;
          } else if (targetKey.length === 1 && pressedKey === targetKey) {
            keyMatch = true;
          } else if (targetKey === pressedKey) {
            keyMatch = true;
          }
        } else {
          keyMatch = true;
        }

        if (modifierMatch && keyMatch) {
          e.preventDefault();
          handler(e);
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}

export default useKeyboardShortcuts;
