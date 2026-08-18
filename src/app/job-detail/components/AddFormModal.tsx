"use client";

import React from "react";
import { X, Paintbrush, Hammer } from "lucide-react";
import type { FormType } from "@/types";

interface AddFormModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (formType: FormType) => void;
}

interface TemplateOption {
  type: FormType;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
}

const TEMPLATES: TemplateOption[] = [
  {
    type: "painting",
    title: "Painting Job Form",
    description:
      "Existing form template — includes Coat, Paint Type and area measurements (m² / ft² / rft).",
    icon: <Paintbrush size={26} />,
    accent: "bg-primary/10 text-primary",
  },
  {
    type: "carpenter",
    title: "Carpenter Job Form",
    description:
      "New template — the Coat column is removed and a Height (m) column is added for measurements.",
    icon: <Hammer size={26} />,
    accent:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
];

export default function AddFormModal({
  open,
  onClose,
  onSelect,
}: AddFormModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-lg">
              Add New Form
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Choose a form template to create.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.type}
              type="button"
              onClick={() => onSelect(tpl.type)}
              className="flex items-start gap-4 p-4 rounded-lg border border-border text-left hover:border-primary hover:bg-secondary/40 transition-colors scale-press group"
            >
              <span
                className={`shrink-0 p-3 rounded-lg ${tpl.accent} transition-transform group-hover:scale-105`}
              >
                {tpl.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-foreground">
                  {tpl.title}
                </span>
                <span className="block text-sm text-muted-foreground mt-1">
                  {tpl.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
