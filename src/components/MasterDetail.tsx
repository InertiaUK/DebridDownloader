import { useState, useEffect, useRef, useCallback } from "react";

interface MasterDetailProps {
  listPanel: React.ReactNode;
  detailPanel: React.ReactNode;
  defaultRatio?: number;
}

const MIN_PANEL_WIDTH = 280;

export default function MasterDetail({
  listPanel,
  detailPanel,
  defaultRatio = 0.55,
}: MasterDetailProps) {
  const [ratio, setRatio] = useState<number>(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // Load saved ratio from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("panel-split-ratio");
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) {
        setRatio(parsed);
      }
    }
  }, []);

  // Save ratio to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("panel-split-ratio", String(ratio));
  }, [ratio]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const containerWidth = rect.width;
    const mouseX = e.clientX - rect.left;

    // Clamp so each panel has at least MIN_PANEL_WIDTH
    const minRatio = MIN_PANEL_WIDTH / containerWidth;
    const maxRatio = 1 - MIN_PANEL_WIDTH / containerWidth;

    const newRatio = Math.min(maxRatio, Math.max(minRatio, mouseX / containerWidth));
    setRatio(newRatio);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    // Save final ratio to localStorage
    localStorage.setItem("panel-split-ratio", String(ratio));
  }, [handleMouseMove, ratio]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [handleMouseMove, handleMouseUp]
  );

  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      <div
        style={{ width: `${ratio * 100}%` }}
        className="overflow-y-auto bg-[#08080f]"
      >
        {listPanel}
      </div>
      <div
        className="w-px bg-[rgba(255,255,255,0.04)] cursor-col-resize relative"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <div
        style={{ width: `${(1 - ratio) * 100}%` }}
        className="overflow-y-auto bg-[#0c0c16]"
      >
        {detailPanel}
      </div>
    </div>
  );
}
