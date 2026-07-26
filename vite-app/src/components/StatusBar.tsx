export default function StatusBar({ dark = false }: { dark?: boolean }) {
  const color = dark ? "#fff" : "#2b2540";
  return (
    <div
      className="flex items-center justify-between px-6 pb-1.5 pt-3 text-[13px] font-semibold"
      style={{ color }}
    >
      <span>9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11">
          <rect x="0" y="6" width="3" height="5" rx="1" fill={color} />
          <rect x="4.5" y="4" width="3" height="7" rx="1" fill={color} />
          <rect x="9" y="2" width="3" height="9" rx="1" fill={color} />
          <rect x="13.5" y="0" width="3" height="11" rx="1" fill={color} />
        </svg>
        <svg width="22" height="11" viewBox="0 0 22 11">
          <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" fill="none" stroke={color} opacity="0.5" />
          <rect x="2" y="2" width="13" height="7" rx="1" fill={color} />
          <rect x="20" y="3.5" width="1.5" height="4" rx="0.75" fill={color} />
        </svg>
      </span>
    </div>
  );
}
