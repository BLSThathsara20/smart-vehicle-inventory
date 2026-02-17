import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNotification } from "../context/NotificationContext";
import { supabase } from "../lib/supabase";
import { Car, Lock, Mail, UserPlus } from "lucide-react";

export function Login() {
  const [mode, setMode] = useState(null); // null = loading, 'register' | 'login'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { addNotification } = useNotification();

  useEffect(() => {
    supabase
      .from("admins")
      .select("id")
      .limit(1)
      .then(({ data, error }) => {
        if (error) {
          // Table might not exist yet - treat as no admins, show register
          setMode("register");
          return;
        }
        setMode(data?.length ? "login" : "register");
      });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      addNotification("Welcome back!", "success");
    } catch (err) {
      addNotification(err.message || "Invalid credentials", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addNotification("Passwords do not match", "error");
      return;
    }
    if (password.length < 6) {
      addNotification("Password must be at least 6 characters", "error");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      const { error } = await supabase.from("admins").insert({ email });
      if (error) throw error;
      addNotification("Super admin registered! You can now sign in.", "success");
      setMode("login");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      addNotification(err.message || "Registration failed", "error");
    } finally {
      setLoading(false);
    }
  };

  if (mode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isRegister = mode === "register";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500 flex items-center justify-center">
            <Car className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-white mb-2">
          Vehicle Inventory
        </h1>
        <p className="text-slate-400 text-center text-sm mb-8">
          {isRegister
            ? "Super Admin Registration (first time only)"
            : "Super Admin Login"}
        </p>

        <form
          onSubmit={isRegister ? handleRegister : handleLogin}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? isRegister
                ? "Registering..."
                : "Signing in..."
              : isRegister
                ? "Register Super Admin"
                : "Sign In"}
            {isRegister && <UserPlus className="w-4 h-4" />}
          </button>
        </form>

        {isRegister && (
          <p className="text-slate-500 text-center text-xs mt-4">
            After registration, only login will be shown. This is one-time only.
          </p>
        )}
      </div>
    </div>
  );
}
