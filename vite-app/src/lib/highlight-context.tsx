import { createContext, useContext, useRef, useState } from "react";
import type { RiskLevel } from "./data";

interface HighlightContextValue {
  riskFocusLevel: RiskLevel | null;
  focusRiskLevel: (level: RiskLevel) => void;
}

const HighlightContext = createContext<HighlightContextValue | null>(null);

const HIGHLIGHT_DURATION_MS = 2000;

export function HighlightProvider({ children }: { children: React.ReactNode }) {
  const [riskFocusLevel, setRiskFocusLevel] = useState<RiskLevel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function focusRiskLevel(level: RiskLevel) {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setRiskFocusLevel(level);
    timeoutRef.current = setTimeout(() => setRiskFocusLevel(null), HIGHLIGHT_DURATION_MS);
  }

  return (
    <HighlightContext.Provider value={{ riskFocusLevel, focusRiskLevel }}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const ctx = useContext(HighlightContext);
  if (!ctx) throw new Error("useHighlight must be used within HighlightProvider");
  return ctx;
}
