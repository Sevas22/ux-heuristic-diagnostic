import type { ScreenshotZone } from "@/hooks/useReportPolling";

// Centro aproximado de cada celda del grid 3x3, en % del ancho/alto de la captura.
export const ZONE_POSITION: Record<ScreenshotZone, { x: number; y: number }> = {
  "top-left": { x: 16, y: 16 },
  "top-center": { x: 50, y: 16 },
  "top-right": { x: 84, y: 16 },
  "middle-left": { x: 16, y: 50 },
  "middle-center": { x: 50, y: 50 },
  "middle-right": { x: 84, y: 50 },
  "bottom-left": { x: 16, y: 84 },
  "bottom-center": { x: 50, y: 84 },
  "bottom-right": { x: 84, y: 84 },
};
