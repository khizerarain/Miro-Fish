"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

export function VirtualList<T>({
  items,
  rowHeight,
  height,
  render,
  overscan = 8,
}: {
  items: T[];
  rowHeight: number;
  height: number;
  render: (item: T, index: number) => ReactNode;
  overscan?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const start = Math.max(0, Math.floor(scroll / rowHeight) - overscan);
  const visible = Math.ceil(height / rowHeight) + overscan * 2;
  const slice = useMemo(() => items.slice(start, start + visible), [items, start, visible]);

  return (
    <div
      ref={ref}
      className="overflow-auto"
      style={{ height }}
      onScroll={(e) => setScroll((e.target as HTMLDivElement).scrollTop)}
    >
      <div style={{ height: items.length * rowHeight, position: "relative" }}>
        <div style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
          {slice.map((item, i) => (
            <div key={start + i} style={{ height: rowHeight }}>
              {render(item, start + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
