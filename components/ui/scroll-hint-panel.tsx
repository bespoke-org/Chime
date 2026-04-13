"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";

export function ScrollHintPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const target = element;

    function updateScrollState(node: HTMLDivElement) {
      setCanScrollUp(node.scrollTop > 4);
      setCanScrollDown(
        node.scrollTop + node.clientHeight < node.scrollHeight - 4,
      );
    }

    function handleScroll() {
      updateScrollState(target);
    }

    updateScrollState(target);
    target.addEventListener("scroll", handleScroll);

    const resizeObserver = new ResizeObserver(() => updateScrollState(target));
    resizeObserver.observe(target);

    return () => {
      target.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative">
      {canScrollUp ? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2">
          <div className="flex size-7 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--surface-strong)]/95 text-[var(--ink)] shadow-[var(--shadow-elevated)] backdrop-blur-sm">
            <ArrowUp className="size-4" />
          </div>
        </div>
      ) : null}
      <div ref={containerRef} className={cn(className)}>
        {children}
      </div>
      {canScrollDown ? (
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-10 -translate-x-1/2">
          <div className="flex size-7 items-center justify-center rounded-full border border-[color:var(--line)] bg-[var(--surface-strong)]/95 text-[var(--ink)] shadow-[var(--shadow-elevated)] backdrop-blur-sm">
            <ArrowDown className="size-4" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
