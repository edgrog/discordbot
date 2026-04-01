"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

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
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🍋</div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Grog
        </h1>
        <p className="text-sm text-gray-500 mt-1">Partner Dashboard</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        {accessDenied && state === "idle" && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            You don&apos;t have access. Contact Ed.
          </div>
        )}

        {state === "sent" ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3 animate-in zoom-in duration-300" />
            <h2 className="text-lg font-semibold text-gray-900">
              Check your inbox
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              We sent a magic link to{" "}
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-gray-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                  autoFocus
                  required
                />
              </div>

              {state === "error" && errorMsg && (
                <p className="text-sm text-red-600">{errorMsg}</p>
              )}

              <Button
                type="submit"
                disabled={state === "loading"}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white"
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
  );
}
