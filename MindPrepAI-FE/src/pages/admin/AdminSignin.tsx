import { useState } from "react";
import axios, { isAxiosError } from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../../config/config";
import { AuthField, AuthShell, AuthSubmit, PasswordField, type AuthMood } from "../../components/common/AuthShell";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";
import { isValidEmail } from "../../utils/validation";

export function AdminSignin() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
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
    if (!email.trim()) return fail("email", "Enter your admin email address.");
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

      const role = response.data?.data?.user?.role || "user";
      if (role !== "admin") {
        setLoading(false);
        return fail("email", "This account does not have admin access.");
      }

      localStorage.setItem("adminToken", response.data.token);
      localStorage.setItem("adminRole", role);
      setLoading(false);
      setSuccess(true);
      setTimeout(() => navigate("/admin"), reduced ? 0 : 750);
    } catch (err) {
      setLoading(false);
      const res = isAxiosError(err) ? err.response : undefined;
      const message = res?.data?.message;
      // 401 = wrong credentials, 403 = deactivated account: show the reason under the field.
      if (res && [400, 401, 403, 404].includes(res.status)) {
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
    <AuthShell
      variant="admin"
      title="Admin sign in"
      subtitle="Use your placement-cell admin account."
      mood={mood}
      pulse={pulse}
      shake={shake}
      switchPrompt={{ text: "Not an admin?", label: "Student sign in", to: "/signin" }}
      footerLink={{ text: "New student?", label: "Create a student account →", to: "/signup" }}
    >
      <form onSubmit={signin} className="space-y-4" noValidate>
        <AuthField
          label="Email"
          type="email"
          placeholder="admin@college.edu"
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
          <AuthSubmit loading={loading} success={success} loadingLabel="Verifying…" successLabel="Access granted">
            Sign in to admin
          </AuthSubmit>
        </div>
      </form>
    </AuthShell>
  );
}
