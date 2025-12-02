import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyTextProps {
  text: string;
  className?: string;
  children?: React.ReactNode;
}

export function CopyText({ text, className, children }: CopyTextProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click events
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div
      onClick={handleCopy}
      className={cn(
        "group inline-flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors",
        className
      )}
      title="Klik untuk copy"
    >
      <span className="font-mono text-sm font-semibold">
        {children || text}
      </span>
      {copied ? (
        <Check className="h-3 w-3 text-green-600 opacity-100" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}
