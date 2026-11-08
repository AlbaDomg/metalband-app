'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client';
import { CheckCircle2, Flame, Loader2, Lock, Mail, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (!isSupabaseConfigured) {
        localStorage.setItem('abyss_demo_user', email || 'vocalist@band.metal');
        router.push('/');
        return;
      }

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
          setInfoMsg(
            'Cuenta creada. Revisa tu correo para confirmar el acceso (o desactiva "Confirm email" en Supabase -> Authentication -> Providers -> Email para entrar directo).'
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
      router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center px-6">
      <div className="border border-zinc-800/80 bg-zinc-950/75 p-7 rounded-xl shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-6">
          <img
            src="/logo.png"
            alt="METAL // HUB Logo"
            className="h-12 w-12 object-contain drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]"
          />
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] uppercase text-zinc-100">
              METAL // HUB
            </h1>
            <p className="text-xs uppercase tracking-widest text-zinc-500">
              Metal Band Workspace
            </p>
          </div>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              Email del Miembro
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vocalist@band.metal"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-widest text-zinc-400 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/90 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-xs text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 py-3 text-xs font-black uppercase tracking-[0.2em] text-zinc-950 shadow-lg shadow-emerald-950/60 transition disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignUp ? 'Registrar Miembro' : 'Entrar al Local'}
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-900 pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
            className="text-xs text-zinc-400 hover:text-emerald-400 transition"
          >
            {isSignUp
              ? '¿Ya tienes cuenta en la banda? Inicia sesión'
              : '¿Nuevo miembro en la banda? Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}
