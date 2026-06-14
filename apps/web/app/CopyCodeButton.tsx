'use client';

import { useState } from 'react';

interface Props {
  code: string;
  label: string;
}

export default function CopyCodeButton({ code, label }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 end-2 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1 rounded-lg transition-colors"
    >
      {copied ? '✓' : label}
    </button>
  );
}
