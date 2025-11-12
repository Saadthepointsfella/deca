"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setErr(null);
    const res = await signIn("credentials", { email, redirect: true, callbackUrl: "/" });
    if (res?.error) setErr("Login failed");
  };

  return (
    <div className="max-w-sm">
      <h2 className="text-2xl font-semibold mb-4">Sign in</h2>
      <input
        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm mb-2"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        className="bg-blue-600 hover:bg-blue-500 text-sm px-4 py-2 rounded disabled:opacity-50"
        disabled={!email}
        onClick={onSubmit}
      >
        Continue
      </button>
      {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
    </div>
  );
}
