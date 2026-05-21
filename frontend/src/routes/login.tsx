import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, ShieldCheck, User, Loader2 } from "lucide-react";
import { useAuth, landingFor } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Secure Login · Aviation SIEM" },
      { name: "description", content: "Biometric secure access to the Aviation SIEM war room." },
    ],
  }),
});

function LoginPage() {
  const { login, user, ready } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) navigate({ to: landingFor(user.role) });
  }, [ready, user, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(username, password);
      navigate({ to: landingFor(u.role) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failure");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#030308] text-zinc-200">
      {/* Radar background */}
      <RadarBackdrop />

      {/* Glassmorphism card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="relative rounded-md border border-cyan-400/30 bg-white/[0.03] p-8 shadow-[0_0_60px_-15px_rgba(34,211,238,0.4)] backdrop-blur-xl">
          {/* Corner brackets */}
          <CornerBrackets />

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-sm border border-cyan-400/40 bg-cyan-400/10">
              <img src="/nazar.jpeg" alt="Nazar" className="h-full w-full object-cover" />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.35em] text-cyan-400/70">AVIATION SIEM</div>
              <div className="text-base font-bold tracking-[0.25em] text-zinc-100">SECURE ACCESS</div>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field
              icon={<User className="h-4 w-4" />}
              label="OPERATOR ID"
              value={username}
              onChange={setUsername}
              placeholder="admin · analyst · observer"
              autoFocus
            />
            <Field
              icon={<Lock className="h-4 w-4" />}
              label="PASSPHRASE"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />

            {error && (
              <div className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-[10px] tracking-[0.2em] text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !username || !password}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-sm border border-cyan-400/50 bg-cyan-400/10 px-4 py-3 text-[11px] font-bold tracking-[0.35em] text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AUTHENTICATING…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  INITIATE HANDSHAKE
                </>
              )}
            </button>

            <div className="text-center text-[9px] tracking-[0.2em] text-zinc-600">
              DEMO · admin_operator/admin · analyst_operator/analyst · observer_operator/observer
            </div>
          </form>
        </div>

        {/* Secure connection badge */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-sm border border-emerald-400/30 bg-emerald-400/5 px-3 py-2 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[9px] tracking-[0.35em] text-emerald-400">
            SECURE CONNECTION ESTABLISHED · TLS 1.3 · AES-256-GCM
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoFocus,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] tracking-[0.35em] text-cyan-400/70">{label}</span>
      <div className="flex items-center gap-2 rounded-sm border border-cyan-400/20 bg-black/40 px-3 py-2 transition focus-within:border-cyan-400/60 focus-within:bg-black/60">
        <span className="text-cyan-400/60">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full bg-transparent text-sm tracking-wider text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        />
      </div>
    </label>
  );
}

function CornerBrackets() {
  const cls = "pointer-events-none absolute h-3 w-3 border-cyan-400/70";
  return (
    <>
      <span className={`${cls} -left-px -top-px border-l border-t`} />
      <span className={`${cls} -right-px -top-px border-r border-t`} />
      <span className={`${cls} -bottom-px -left-px border-b border-l`} />
      <span className={`${cls} -bottom-px -right-px border-b border-r`} />
    </>
  );
}

function RadarBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Grid */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#030308_75%)]" />

      {/* Radar rings */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-cyan-400/15"
            style={{
              width: `${i * 220}px`,
              height: `${i * 220}px`,
              left: `${-i * 110}px`,
              top: `${-i * 110}px`,
            }}
          />
        ))}
        {/* Sweep */}
        <div
          className="absolute left-0 top-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 origin-center"
          style={{ animation: "radarSweep 6s linear infinite" }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[450px] w-[450px] origin-top-left"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(34,211,238,0.35) 0deg, rgba(34,211,238,0) 60deg)",
              clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes radarSweep {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
