"use client";

import React, { useEffect, useRef } from "react";

/**
 * A table wrapper whose <thead> (the navy blue column header row)
 * dynamically moves down with the user as they scroll down the board,
 * staying pinned right below the top navigation bar.
 */
export default function StickyTable({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    let rafId: number | null = null;

    const updateHeaderPosition = () => {
      const tableEl = tableRef.current;
      if (!tableEl) return;
      const theadEl = tableEl.querySelector("thead") as HTMLElement | null;
      if (!theadEl) return;

      const headerEl = document.querySelector("header");
      const headerBottom = headerEl
        ? Math.max(0, headerEl.getBoundingClientRect().bottom)
        : 0;

      const tableRect = tableEl.getBoundingClientRect();
      const theadHeight = theadEl.offsetHeight || 42;

      if (
        tableRect.top < headerBottom &&
        tableRect.bottom > headerBottom + theadHeight
      ) {
        const offset = Math.min(
          tableRect.height - theadHeight,
          headerBottom - tableRect.top
        );
        theadEl.style.transform = `translate3d(0, ${offset}px, 0)`;
        theadEl.style.position = "relative";
        theadEl.style.zIndex = "25";
        theadEl.style.boxShadow = "0 4px 10px rgba(20, 28, 60, 0.22)";
      } else {
        theadEl.style.transform = "";
        theadEl.style.boxShadow = "";
      }
    };

    const onScrollOrResize = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateHeaderPosition);
    };

    updateHeaderPosition();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [children]);

  return (
    <div
      ref={containerRef}
      className="bg-white rounded-lg border border-[#dce1ec] shadow-xs overflow-x-auto"
    >
      <table
        ref={tableRef}
        className={`cap-table w-full text-left text-[13.5px] ${className}`}
      >
        {children}
      </table>
    </div>
  );
}
