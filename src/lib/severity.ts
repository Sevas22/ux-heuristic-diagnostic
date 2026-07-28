// Paleta de estado validada (skill de dataviz): fija, nunca se tematiza con la marca.
export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export type StatusRole = keyof typeof STATUS_COLORS;

export function severityStatus(severity: number): StatusRole {
  if (severity <= 1) return "good";
  if (severity === 2) return "warning";
  if (severity === 3) return "serious";
  return "critical";
}

export function priorityStatus(priority: string): StatusRole {
  if (priority === "Alta") return "critical";
  if (priority === "Media") return "warning";
  return "good";
}

export function scoreStatus(score: number): StatusRole {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  if (score >= 40) return "serious";
  return "critical";
}
