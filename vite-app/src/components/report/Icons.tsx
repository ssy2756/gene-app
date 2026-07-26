export function BackIcon() {
  return (
    <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
      <path d="M8 1L1.5 7.5 8 14" stroke="#3A2F88" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-none">
      <circle cx="12" cy="12" r="9" stroke="#4D3F9C" strokeWidth="2" />
      <path d="M12 11v5M12 8v.01" stroke="#4D3F9C" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ color = "#2fb08c" }: { color?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 flex-none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path d="M8.5 12l2.5 2.5 4.5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6.5" stroke="#9a8fb0" strokeWidth="1.8" />
      <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="#9a8fb0" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M8 12h8M12 8l4 4-4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7V5a1 1 0 011-1h4M4 17v2a1 1 0 001 1h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path d="M1 1l5 5-5 5" stroke="#c9bdde" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
