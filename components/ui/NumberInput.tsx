"use client";

import {
  useEffect,
  useState,
  type FocusEventHandler,
  type InputHTMLAttributes,
} from "react";

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  value: number;
  onChange: (value: number) => void;
  /** Value applied when the field is left empty on blur */
  emptyValue?: number;
};

function clampNumber(value: number, min?: number | string, max?: number | string) {
  let next = value;
  if (min !== undefined && min !== "" && Number.isFinite(Number(min))) {
    next = Math.max(Number(min), next);
  }
  if (max !== undefined && max !== "" && Number.isFinite(Number(max))) {
    next = Math.min(Number(max), next);
  }
  return next;
}

/**
 * Number field that can be cleared while typing (avoids sticky "0" → "010").
 * Commits/clamps on blur; pushes parsed values while the draft is a valid number.
 */
export default function NumberInput({
  value,
  onChange,
  emptyValue,
  min,
  max,
  onBlur,
  onFocus,
  ...rest
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => String(value));

  useEffect(() => {
    if (!focused) setText(String(value));
  }, [focused, value]);

  const fallback = () => {
    if (emptyValue !== undefined) return emptyValue;
    if (min !== undefined && min !== "" && Number.isFinite(Number(min))) {
      return Number(min);
    }
    return 0;
  };

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      const next = clampNumber(fallback(), min, max);
      onChange(next);
      setText(String(next));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }
    const next = clampNumber(parsed, min, max);
    onChange(next);
    setText(String(next));
  };

  const handleFocus: FocusEventHandler<HTMLInputElement> = (event) => {
    setFocused(true);
    setText(String(value));
    onFocus?.(event);
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    setFocused(false);
    commit(text);
    onBlur?.(event);
  };

  return (
    <input
      {...rest}
      type="number"
      min={min}
      max={max}
      value={focused ? text : String(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={(event) => {
        const next = event.target.value;
        setText(next);
        if (next.trim() === "") return;
        const parsed = Number(next);
        if (!Number.isFinite(parsed)) return;
        // Do not clamp while typing so users can clear and re-enter values.
        onChange(parsed);
      }}
    />
  );
}
