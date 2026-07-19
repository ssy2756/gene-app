"use client";

import { useState } from "react";

export function UploadSheet({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: (uid: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resultUid, setResultUid] = useState<string | null>(null);

  async function handleUpload() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/parse-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not parse this PDF");
        setStatus("error");
        return;
      }
      setResultUid(data.uid);
      setStatus("done");
    } catch {
      setError("Upload failed. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-30 flex items-end justify-center bg-[rgba(20,10,35,.4)]">
      <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-md rounded-t-3xl bg-white p-6 pb-8">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#e0d8ec]" />
        <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-[#f3eef9] text-2xl">
          ⬆
        </div>
        <div className="mt-2.5 text-center text-lg font-bold">Upload a new report</div>

        {status !== "done" && (
          <>
            <div className="mt-2 text-center text-[13.5px] leading-relaxed text-[#524a66]">
              Upload a PDF genetic test report. It will be parsed automatically and stored under the UID found inside
              it.
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[#ded2ef] bg-[#faf8fc] px-4 py-5 text-center text-[13.5px] text-[#524a66]">
              {file ? file.name : "Choose a PDF file…"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={handleUpload}
              disabled={!file || status === "uploading"}
              className="mt-5 w-full rounded-2xl bg-[#3A2F88] py-3.5 text-center text-sm font-semibold text-white disabled:opacity-50"
            >
              {status === "uploading" ? "Parsing…" : "Upload & parse"}
            </button>
          </>
        )}

        {status === "done" && resultUid && (
          <>
            <div className="mt-2 text-center text-[13.5px] leading-relaxed text-[#524a66]">
              Parsed successfully. Report UID:
              <div className="mt-1 font-mono text-base font-semibold text-[#2b2540]">{resultUid}</div>
            </div>
            <button
              onClick={() => onUploaded(resultUid)}
              className="mt-5 w-full rounded-2xl bg-[#3A2F88] py-3.5 text-center text-sm font-semibold text-white"
            >
              Load this report
            </button>
          </>
        )}

        <button onClick={onClose} className="mt-2.5 w-full rounded-2xl py-3 text-center text-sm font-semibold text-[#8a819c]">
          Cancel
        </button>
      </div>
    </div>
  );
}
