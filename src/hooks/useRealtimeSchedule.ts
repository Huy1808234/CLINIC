"use client";

import { useEffect } from "react";
import { createClient } from "@/supabase-clients/browser";

export interface RealtimeScheduleOptions {
  monthOrDateStr?: string; // e.g. "2026-08" or "2026-08-21"
  doctorId?: string;
  onUpdate: () => void;
}

/**
 * Realtime hook subscribing to appointment changes (AC-09)
 */
export function useRealtimeSchedule(options: RealtimeScheduleOptions) {
  useEffect(() => {
    const supabase = createClient();
    const channelName = `realtime-schedule-${options.monthOrDateStr || "all"}-${options.doctorId || "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
        },
        () => {
          options.onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [options]);
}
