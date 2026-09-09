"use client";

import { useState } from "react";

/** Copy report (as plain text) and print — the handbook's required export/copy. */
export function ReportActions({ plainText }: { plainText: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="no-print flex gap-2">
      <button onClick={copy} className="btn-ghost">
        {copied ? "Copied ✓" : "Copy report"}
      </button>
      <button onClick={() => window.print()} className="btn-primary">
        Print view
      </button>
    </div>
  );
}
