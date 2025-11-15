// in layout shell, e.g. frontend/src/components/AppShell.tsx
"use client";

import { supabaseBrowser } from "../lib/supabaseClient";
import Button from "./ui/Button";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  const signOut = async () => {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button variant="outline" size="sm" onClick={signOut}>
      Sign out
    </Button>
  );
}
