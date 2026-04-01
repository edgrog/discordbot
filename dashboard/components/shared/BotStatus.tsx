"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";

export function BotStatus() {
  const [heartbeat, setHeartbeat] = useState<string | null>(null);
  const [formsLoaded, setFormsLoaded] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function fetchStatus() {
      const { data } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["bot_heartbeat", "forms_last_loaded"]);

      if (data) {
        for (const row of data) {
          if (row.key === "bot_heartbeat" && row.value)
            setHeartbeat(row.value);
          if (row.key === "forms_last_loaded" && row.value)
            setFormsLoaded(row.value);
        }
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  function getStatusColor() {
    if (!heartbeat) return "bg-gray-500";
    const diff = Date.now() - new Date(heartbeat).getTime();
    if (diff < 2 * 60 * 1000) return "bg-green-500";
    if (diff < 5 * 60 * 1000) return "bg-amber-500";
    return "bg-red-500";
  }

  function getStatusLabel() {
    if (!heartbeat) return "No heartbeat";
    const diff = Date.now() - new Date(heartbeat).getTime();
    if (diff < 2 * 60 * 1000) return "Bot online";
    if (diff < 5 * 60 * 1000) return "Bot slow";
    return "Bot offline";
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full ${getStatusColor()} ${
            heartbeat &&
            Date.now() - new Date(heartbeat).getTime() < 2 * 60 * 1000
              ? "animate-pulse"
              : ""
          }`}
        />
        <span className="text-xs text-[#9CA3AF]">{getStatusLabel()}</span>
      </div>
      {formsLoaded && (
        <p className="text-xs text-[#6B7280] ml-4">
          Forms loaded{" "}
          {formatDistanceToNow(new Date(formsLoaded), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
