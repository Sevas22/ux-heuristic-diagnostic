import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type SubmissionStatus = "draft" | "paid" | "generating" | "ready" | "failed";

export interface ExecutiveSummary {
  product_description: string;
  analysis_objective: string;
  general_assessment: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Methodology {
  flow_analyzed: string;
  criteria: string;
  screens_evaluated: string[];
}

export const SCREENSHOT_ZONES = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type ScreenshotZone = (typeof SCREENSHOT_ZONES)[number];

export interface Finding {
  id: string;
  screen: string;
  heuristic: string;
  severity: number;
  impact_score: number;
  description: string;
  user_impact: string;
  recommendation: string;
  priority: "Alta" | "Media" | "Baja";
  zone: ScreenshotZone | null;
  evidence_ref: string;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcpMs: number | null;
  clsScore: number | null;
  tbtMs: number | null;
}

export interface NavEdge {
  from: string;
  to: string;
}

export interface JourneyStep {
  label: string;
  score: number;
}

export interface JourneySection {
  section: string;
  steps: JourneyStep[];
}

export interface Conclusions {
  risks: string[];
  quick_wins: string[];
  mid_term: string[];
  strategic_recommendations: string[];
  final_score: number;
}

export interface ReferenceScreenshot {
  url: string;
  screenshot_url: string;
}

export interface ReportRow {
  status: SubmissionStatus;
  website_url: string;
  screenshot_url: string | null;
  industry: string | null;
  reference_urls: string[] | null;
  goal: string | null;
  overall_score: number | null;
  executive_summary: ExecutiveSummary | null;
  methodology: Methodology | null;
  findings: Finding[] | null;
  navigation_graph: NavEdge[] | null;
  user_flow: string[] | null;
  journey_map: JourneySection[] | null;
  conclusions: Conclusions | null;
  reference_screenshots: ReferenceScreenshot[] | null;
  lighthouse: LighthouseScores | null;
  pdf_url: string | null;
  created_at: string | null;
}

const POLL_INTERVAL_MS = 3000;

export function useReportPolling(accessToken: string | undefined) {
  const [data, setData] = useState<ReportRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    let intervalId: number | undefined;

    async function fetchOnce() {
      const { data: rows, error: rpcError } = await supabase.rpc("get_report_by_token", {
        p_token: accessToken,
      });

      if (cancelled) return;
      setLoading(false);

      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      const row = (rows?.[0] as ReportRow | undefined) ?? null;
      setData(row);

      if (row && (row.status === "ready" || row.status === "failed") && intervalId) {
        clearInterval(intervalId);
      }
    }

    fetchOnce();
    intervalId = window.setInterval(fetchOnce, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [accessToken]);

  return { data, error, loading };
}
