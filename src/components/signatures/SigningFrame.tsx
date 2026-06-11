"use client";

// Responsive DocuSeal signing iframe wrapper.
// On mobile: full-screen modal takeover.
// On desktop: inline within the contract detail layout.

import { useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface SigningFrameProps {
  signingUrl: string;
  contractTitle: string;
  onComplete?: () => void;
}

export function SigningFrame({ signingUrl, contractTitle, onComplete }: SigningFrameProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <>
      {/* Desktop: inline container */}
      <div className={cn("hidden md:block", isFullscreen && "md:hidden")}>
        <div className="rounded-lg border overflow-hidden" style={{ height: "700px" }}>
          <iframe
            src={signingUrl}
            className="w-full h-full border-0"
            title={`Sign: ${contractTitle}`}
            allow="camera"
          />
        </div>
      </div>

      {/* Mobile: fullscreen button + modal */}
      <div className="md:hidden">
        <Button
          className="w-full"
          size="lg"
          onClick={() => setIsFullscreen(true)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          Open Signing Interface
        </Button>
      </div>

      {/* Fullscreen modal (both mobile trigger and desktop toggle) */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3 bg-card">
            <span className="text-sm font-medium truncate max-w-[calc(100vw-80px)]">
              Sign: {contractTitle}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <iframe
            src={signingUrl}
            className="flex-1 w-full border-0"
            title={`Sign: ${contractTitle}`}
            allow="camera"
          />
        </div>
      )}
    </>
  );
}
