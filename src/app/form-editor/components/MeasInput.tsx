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
 *
 * The user always enters the measurement in METERS (after picking an ARC item,
 * which sets the UOM). For feet-based UOMs (sqft / rft / cft):
 *  - the meter value is stored as-is (the "temporary" value),
 *  - the cell then DISPLAYS the auto-converted FEET value (2 decimals),
 *  - when the cell is focused again the meter value is restored so the user can
 *    edit/correct it in meters; if it is edited or erased it updates accordingly.
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

  // While not editing, show the value in FEET for feet-based UOMs (the entered
  // meter value is converted and replaces the cell content) — always with 2
  // decimal places. While editing, the meter value is shown so corrections are
  // made in meters.
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
    if (raw === "") {
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
      // The user enters the measurement in METERS — store the original value
      // with high precision (6 decimals). The cell display shows the converted
      // feet (trimmed); the meter value is kept until edited or erased.
      onChange(parseFloat(n.toFixed(6)));
    }
  };

  return (
    <input
      type="number"
      step={field === "no" ? "1" : "0.01"}
      min="0"
      value={display}
      disabled={disabled}
      onChange={handleChange}
      onFocus={(e) => {
        // Begin editing in METERS (the temporary value); the feet value is
        // shown after blur so the user can correct the meter entry.
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
