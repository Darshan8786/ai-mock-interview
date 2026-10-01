import axios, { isAxiosError } from "axios";
import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config/config";
import { AuthField, AuthShell, AuthSubmit, PasswordField, type AuthMood } from "../components/common/AuthShell";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { isValidEmail } from "../utils/validation";

export function Signin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);
  const [failed, setFailed] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [shake, setShake] = useState(0);
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  const mood: AuthMood = success ? "success" : loading ? "loading" : failed ? "error" : focused ?? "idle";

  const fail = (field: "email" | "password", message: string) => {
    if (field === "email") setEmailError(message);
    else setPasswordError(message);
    setFailed(true);
    setShake((n) => n + 1);
  };

  async function signin(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    if (!email.trim()) return fail("email", "Enter your email address.");
    if (!isValidEmail(email)) return fail("email", "That doesn't look like a valid email.");
    if (!password) return fail("password", "Enter your password.");

    setFailed(false);
    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
        email: email.trim(),
        password,
      });

      if (response.data.status !== "success") {
        setLoading(false);
        return fail("password", response.data.message || "Incorrect email or password.");
      }

      const jwt = response.data.token;
      const role = response.data?.data?.user?.role || "user";
      localStorage.setItem("token", jwt);
      localStorage.setItem("role", role);
      if (role === "admin") {
        localStorage.setItem("adminToken", jwt);
        localStorage.setItem("adminRole", role);
      }
      setLoading(false);
      setSuccess(true);
      // Let the success animation play before leaving the page.
      setTimeout(() => navigate(role === "admin" ? "/admin" : "/dashboard"), reduced ? 0 : 750);
    } catch (err) {
      const response = isAxiosError(err) ? err.response : undefined;
      setLoading(false);
      const status = response?.status;
      const message = response?.data?.message;
      // 401 = wrong credentials, 403 = deactivated account: show the reason under the field.
      if (status === 400 || status === 401 || status === 403 || status === 404) {
        fail("password", message || "Incorrect email or password.");
      } else {
        setFailed(true);
        setShake((n) => n + 1);
        toast.error(message || "Couldn't reach the server. Check your connection and try again.");
      }
    }
  }

  const onType = (setter: (v: string) => void, clear: () => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    clear();
    setFailed(false);
    setPulse((n) => n + 1);
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue your preparation." mood={mood} pulse={pulse} shake={shake}
      switchPrompt={{ text: "New here?", label: "Create an account", to: "/signup" }}>
      <form onSubmit={signin} className="space-y-4" noValidate>
        <AuthField
          label="Email"
          type="email"
          placeholder="you@college.edu"
          autoComplete="username"
          autoFocus
          value={email}
          error={emailError}
          onChange={onType(setEmail, () => setEmailError(null))}
          onFocus={() => setFocused("email")}
          onBlur={() => {
            setFocused(null);
            if (email && !isValidEmail(email)) setEmailError("That doesn't look like a valid email.");
          }}
        />
        <PasswordField
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          error={passwordError}
          onChange={onType(setPassword, () => setPasswordError(null))}
          onFocus={() => setFocused("password")}
          onBlur={() => setFocused(null)}
        />
        <div className="pt-1">
          <AuthSubmit loading={loading} success={success}>Sign in</AuthSubmit>
        </div>
      </form>
    </AuthShell>
  );
}
