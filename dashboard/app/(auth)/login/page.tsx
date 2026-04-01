"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Zap } from "lucide-react";

type LoginState = "idle" | "loading" | "sent" | "error";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const searchParams = useSearchParams();
  const accessDenied = searchParams.get("error") === "access_denied";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState("loading");
    setErrorMsg("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    });

    if (error) {
      setState("error");
      setErrorMsg(error.message);
      return;
    }

    setState("sent");
  }

  return (
    <div className="min-h-screen bg-chalk flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-pop-lime border-3 border-ink mx-auto mb-4 flex items-center justify-center brutalist-shadow">
            <Zap className="w-6 h-6 text-ink" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-ink uppercase">
            Formie
          </h1>
          <p className="text-sm text-ink/50 mt-1 font-medium">Discord Form Builder</p>
        </div>

        <div className="bg-card border-3 border-ink p-6 brutalist-shadow">
          {accessDenied && state === "idle" && (
            <div className="mb-4 p-3 bg-pop-pink/10 border-2 border-pop-pink text-sm font-bold text-ink">
              You don&apos;t have access. Contact the admin.
            </div>
          )}

          {state === "sent" ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-pop-lime border-2 border-ink mx-auto mb-3 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-ink" />
              </div>
              <h2 className="text-lg font-black text-ink uppercase">
                Check your inbox
              </h2>
              <p className="text-sm text-ink/50 mt-1">
                Magic link sent to{" "}
                <span className="font-bold text-ink">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-xs font-black text-ink uppercase tracking-wide">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 border-2 border-ink rounded-none font-medium focus:ring-0 focus:border-ink"
                    autoFocus
                    required
                  />
                </div>

                {state === "error" && errorMsg && (
                  <p className="text-sm font-bold text-pop-pink">{errorMsg}</p>
                )}

                <Button
                  type="submit"
                  disabled={state === "loading"}
                  className="w-full bg-ink hover:bg-ink/90 text-white font-black uppercase tracking-wide rounded-none border-2 border-ink brutalist-shadow-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all"
                >
                  {state === "loading" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
