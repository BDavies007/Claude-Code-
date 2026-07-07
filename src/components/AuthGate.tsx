import { useEffect, useState, ReactNode } from "react";
import { Button } from "./ui/Button";
import { Lock, ShieldCheck } from "lucide-react";

type Mode = "loading" | "create" | "unlock" | "unlocked";

interface Props {
  children: (lock: () => void) => ReactNode;
}

export function AuthGate({ children }: Props) {
  const [mode, setMode] = useState<Mode>("loading");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.atlas) {
      // Running outside Electron (e.g. plain vite preview) — unlocked.
      setMode("unlocked");
      return;
    }
    window.atlas.auth.hasPin().then((has) => setMode(has ? "unlock" : "create"));
  }, []);

  const lock = () => {
    setPin("");
    setConfirm("");
    setError(null);
    setMode("unlock");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "create") {
      if (pin.length < 4) return setError("PIN must be at least 4 digits.");
      if (pin !== confirm) return setError("PINs don't match.");
      await window.atlas.auth.setPin(pin);
      setMode("unlocked");
      setPin("");
      setConfirm("");
    } else if (mode === "unlock") {
      const ok = await window.atlas.auth.verifyPin(pin);
      if (!ok) return setError("Incorrect PIN.");
      setMode("unlocked");
      setPin("");
    }
  };

  if (mode === "loading") {
    return <div className="grid h-screen place-items-center bg-bg text-fg-muted text-sm">Loading…</div>;
  }

  if (mode === "unlocked") return <>{children(lock)}</>;

  const isCreate = mode === "create";

  return (
    <div className="grid h-screen place-items-center bg-bg px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-8 shadow-card"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand text-brand-fg">
            {isCreate ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              {isCreate ? "Secure Atlas Hub" : "Welcome back"}
            </h1>
            <p className="text-xs text-fg-muted">
              {isCreate ? "Choose a PIN to lock this device." : "Enter your PIN to continue."}
            </p>
          </div>
        </div>

        <label className="block text-xs font-medium text-fg-muted">PIN</label>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
        />

        {isCreate && (
          <>
            <label className="mt-3 block text-xs font-medium text-fg-muted">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </>
        )}

        {error && <div className="mt-3 text-xs text-danger">{error}</div>}

        <Button type="submit" className="mt-5 w-full">
          {isCreate ? "Create PIN" : "Unlock"}
        </Button>

        <p className="mt-4 text-[11px] leading-relaxed text-fg-muted">
          PIN is hashed and stored locally with electron-store. It only protects this device — not your
          third-party accounts.
        </p>
      </form>
    </div>
  );
}
