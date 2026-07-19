"use client";

export function DefineSheet({
  term,
  body,
  onClose,
}: {
  term: string | null;
  body: string;
  onClose: () => void;
}) {
  if (!term) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-30 flex items-end justify-center bg-[rgba(20,10,35,.4)]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-md rounded-t-3xl bg-white p-6 pb-8"
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#e0d8ec]" />
        <span className="rounded-lg bg-[#f3eef9] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#4D3F9C]">
          Definition
        </span>
        <div className="mt-3 text-xl font-bold">{term}</div>
        <div className="mt-2 text-sm leading-relaxed text-[#524a66]">{body}</div>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl bg-[#f3eef9] py-3.5 text-center text-sm font-semibold text-[#3A2F88]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
