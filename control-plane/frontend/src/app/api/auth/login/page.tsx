"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "../../../lib/supabaseClient";
import Button from "../../../components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const signInMagicLink = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      setMsg("Check your email for a magic link.");
    } catch (e: any) {
      setMsg(e.message ?? "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full max-w-sm border border-ink-800 rounded-xl p-4 space-y-4">
        <h1 className="text-sm font-medium">Sign in</h1>
        <p className="text-xs text-ink-500">
          Enter your email to receive a magic link.
        </p>
        <input
          type="email"
          className="w-full text-xs px-2 py-1 rounded bg-ink-950 border border-ink-800"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={signInMagicLink} disabled={!email || loading} className="w-full">
          {loading ? "Sending…" : "Send magic link"}
        </Button>
        {msg && <p className="text-xs text-ink-400">{msg}</p>}
      </div>
    </div>
  );
}
