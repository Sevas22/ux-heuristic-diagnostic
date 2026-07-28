import { STATUS_COLORS, type StatusRole } from "@/lib/severity";

// Identidad por punto de color + texto, nunca por color de texto solo
// (warning/serious no cumplen 3:1 de contraste sobre superficie clara).
export default function StatusDot({ status, label }: { status: StatusRole; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-foreground">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: STATUS_COLORS[status] }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
