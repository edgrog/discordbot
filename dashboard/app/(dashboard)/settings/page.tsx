"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BotStatus } from "@/components/shared/BotStatus";
import { RefreshCw, Eye, AlertTriangle } from "lucide-react";

interface SettingsMap {
  [key: string]: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    const supabase = createClient();
    const { data } = await supabase.from("settings").select("key, value");
    if (data) {
      const map: SettingsMap = {};
      for (const row of data) map[row.key] = row.value;
      setSettings(map);
    }
  }

  function updateLocal(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings(keys: string[]) {
    setSaving(keys[0]);
    try {
      const updates = keys.map((key) => ({ key, value: settings[key] || "" }));
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }

      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(null);
    }
  }

  async function pushToBot() {
    setIsPushing(true);
    try {
      const res = await fetch("/api/forms/push", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success("Bot reloaded");
      } else {
        toast.error("Bot unreachable");
      }
    } catch {
      toast.error("Bot unreachable");
    } finally {
      setIsPushing(false);
    }
  }

  function previewTemplate(template: string) {
    return (template || "")
      .replace(/\{name\}/g, "John")
      .replace(/\\n/g, "\n");
  }

  return (
    <div>
      <PageHeader title="Settings" description="Configure Discord and Formie bot settings" />

      <div className="space-y-8 max-w-2xl">
        {/* Discord Configuration */}
        <section className="bg-card border-2 border-ink p-6 brutalist-shadow">
          <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-4">
            Discord Configuration
          </h3>
          <div className="space-y-4">
            {[
              { key: "role_id_creator", label: "Creator Role ID" },
              { key: "role_id_artist", label: "Artist Role ID" },
              { key: "role_id_club", label: "Club Role ID" },
              { key: "role_id_bar", label: "Bar / Venue Role ID" },
              { key: "admin_channel_id", label: "Admin Channel ID" },
            ].map((field) => (
              <div key={field.key}>
                <Label className="text-xs font-black uppercase tracking-wide text-ink/60">{field.label}</Label>
                <Input
                  value={settings[field.key] || ""}
                  onChange={(e) => updateLocal(field.key, e.target.value)}
                  placeholder="Discord ID"
                  className="mt-1 border-2 border-ink rounded-none font-mono text-xs"
                />
              </div>
            ))}
            <Button
              onClick={() =>
                saveSettings([
                  "role_id_creator",
                  "role_id_artist",
                  "role_id_club",
                  "role_id_bar",
                  "admin_channel_id",
                ])
              }
              disabled={saving === "role_id_creator"}
              size="sm"
              className="bg-ink text-white font-black uppercase hover:brutalist-shadow-sm"
            >
              {saving === "role_id_creator" ? "Saving..." : "Save Discord Config"}
            </Button>
          </div>

          <div className="mt-4 p-3 bg-[#FF6B00]/10 border-2 border-ink">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF6B00] mt-0.5 flex-shrink-0" />
              <p className="text-xs font-bold text-ink/80">
                The bot&apos;s role must be placed <strong>above</strong> all
                assigned roles in Discord Server Settings &rarr; Roles. Otherwise, role
                assignment will silently fail.
              </p>
            </div>
          </div>
        </section>

        {/* DM Templates */}
        <section className="bg-card border-2 border-ink p-6 brutalist-shadow">
          <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-4">
            DM Templates
          </h3>
          <p className="text-xs font-bold text-ink/50 mb-4">
            Use <code className="bg-[#BFFF00]/30 border border-ink px-1 font-mono">{"{name}"}</code> to
            insert the applicant&apos;s name.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-black uppercase tracking-wide text-ink/60">
                  Approval Message
                </Label>
                <Dialog>
                  <DialogTrigger className="text-xs font-bold text-ink/50 hover:text-ink flex items-center gap-1 uppercase tracking-wide transition-colors">
                      <Eye className="w-3 h-3" /> Preview
                  </DialogTrigger>
                  <DialogContent className="border-2 border-ink rounded-none brutalist-shadow">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-wide text-ink">Approval DM Preview</DialogTitle>
                    </DialogHeader>
                    <div className="bg-ink text-[#BFFF00] p-4 font-mono text-sm whitespace-pre-wrap border-2 border-ink">
                      {previewTemplate(settings.dm_approve_template || "")}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Textarea
                value={settings.dm_approve_template || ""}
                onChange={(e) =>
                  updateLocal("dm_approve_template", e.target.value)
                }
                rows={4}
                className="border-2 border-ink rounded-none font-mono text-xs"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-black uppercase tracking-wide text-ink/60">
                  Rejection Message
                </Label>
                <Dialog>
                  <DialogTrigger className="text-xs font-bold text-ink/50 hover:text-ink flex items-center gap-1 uppercase tracking-wide transition-colors">
                      <Eye className="w-3 h-3" /> Preview
                  </DialogTrigger>
                  <DialogContent className="border-2 border-ink rounded-none brutalist-shadow">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-wide text-ink">Rejection DM Preview</DialogTitle>
                    </DialogHeader>
                    <div className="bg-ink text-[#FF3366] p-4 font-mono text-sm whitespace-pre-wrap border-2 border-ink">
                      {previewTemplate(settings.dm_reject_template || "")}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              <Textarea
                value={settings.dm_reject_template || ""}
                onChange={(e) =>
                  updateLocal("dm_reject_template", e.target.value)
                }
                rows={4}
                className="border-2 border-ink rounded-none font-mono text-xs"
              />
            </div>

            <Button
              onClick={() =>
                saveSettings(["dm_approve_template", "dm_reject_template"])
              }
              disabled={saving === "dm_approve_template"}
              size="sm"
              className="bg-ink text-white font-black uppercase hover:brutalist-shadow-sm"
            >
              {saving === "dm_approve_template"
                ? "Saving..."
                : "Save DM Templates"}
            </Button>
          </div>
        </section>

        {/* Bot */}
        <section className="bg-card border-2 border-ink p-6 brutalist-shadow">
          <h3 className="text-sm font-black uppercase tracking-wide text-ink mb-4">Formie Bot</h3>

          <div className="mb-4">
            <BotStatus />
          </div>

          <Button
            variant="outline"
            onClick={pushToBot}
            disabled={isPushing}
            className="border-2 border-ink rounded-none font-black uppercase text-xs hover:bg-ink hover:text-white transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isPushing ? "animate-spin" : ""}`}
            />
            {isPushing ? "Reloading..." : "Reload Bot Forms"}
          </Button>
        </section>
      </div>
    </div>
  );
}
