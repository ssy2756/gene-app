"use client";

import { Fragment, useMemo } from "react";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Renders `text` as plain text, except for any substring matching a term in
// `terms` (case-insensitive), which becomes a tappable span that opens the
// glossary sheet via onDefine. Longest terms are matched first so e.g.
// "CYP2C19" wins over a shorter overlapping term.
export function TapDefine({
  text,
  terms,
  onDefine,
}: {
  text: string;
  terms: string[];
  onDefine: (term: string) => void;
}) {
  const regex = useMemo(() => {
    if (terms.length === 0) return null;
    const sorted = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp);
    return new RegExp(`(${sorted.join("|")})`, "gi");
  }, [terms]);

  if (!regex) return <>{text}</>;

  const parts = text.split(regex);
  const termLookup = new Map(terms.map((t) => [t.toLowerCase(), t]));

  return (
    <>
      {parts.map((part, i) => {
        const canonical = termLookup.get(part.toLowerCase());
        if (canonical) {
          return (
            <span
              key={i}
              onClick={() => onDefine(canonical)}
              className="tapword cursor-pointer border-b border-dashed border-[#b9a6d6] font-semibold text-[#3A2F88]"
            >
              {part}
            </span>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
