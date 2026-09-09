"use client";

import React, { useState } from "react";
import { isFtBasedUom, metersToFeet, trimNumber } from "@/utils/helpers";

interface MeasInputProps {
  value: number | "";
  field: "no" | "length" | "width" | "height";
  uom?: string;
  disabled?: boolean;
  onChange: (v: number | "") => void;
}

/**
 * Numeric cell input for Length / Width / Height / No.
 * Supports negative values (e.g. -0.32) for deductions/openings.
 */
export default function MeasInput({
  value,
  field,
  uom,
  disabled = false,
  onChange,
}: MeasInputProps) {
  const [text, setText] = useState<string | null>(null);
  const isFeet = field !== "no" && isFtBasedUom(uom);

  const display =
    text !== null
      ? text
      : value === ""
        ? ""
        : field === "no"
          ? String(value)
          : isFeet
            ? metersToFeet(value).toFixed(2)
            : value.toFixed(2);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value;
    setText(raw);
    if (raw === "" || raw === "-") {
      onChange("");
      return;
    }
    const n = parseFloat(raw);
    if (Number.isNaN(n)) {
      onChange("");
      return;
    }
    if (field === "no") {
      onChange(Math.round(n));
    } else {
      onChange(parseFloat(n.toFixed(6)));
    }
  };

  return (
    <input
      type="number"
      inputMode={field === "no" ? "numeric" : "decimal"}
      step={field === "no" ? "1" : "0.01"}
      value={display}
      disabled={disabled}
      onChange={handleChange}
      onFocus={(e) => {
        setText(
          value === ""
            ? ""
            : field === "no"
              ? String(value)
              : trimNumber(value, 6),
        );
        e.target.select();
      }}
      onBlur={() => setText(null)}
      className={`w-full px-1.5 py-1 bg-input border border-transparent rounded text-right text-xs font-tabular text-foreground focus:outline-none focus:border-ring focus:bg-card transition ${
        disabled ? "opacity-40 cursor-not-allowed" : ""
      }`}
    />
  );
}
