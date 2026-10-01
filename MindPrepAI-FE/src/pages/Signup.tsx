import { useState } from "react";
import axios, { isAxiosError } from "axios";
import { BACKEND_URL } from "../config/config";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { AuthField, AuthShell, AuthSubmit, PasswordField, type AuthMood } from "../components/common/AuthShell";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { isValidEmail } from "../utils/validation";

type Field = "email" | "username" | "password";

export function Signup() {
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
    const [focused, setFocused] = useState<Field | null>(null);
    const [failed, setFailed] = useState(false);
    const [pulse, setPulse] = useState(0);
    const [shake, setShake] = useState(0);
    const navigate = useNavigate();
    const reduced = usePrefersReducedMotion();

    const mood: AuthMood = success ? "success" : loading ? "loading" : failed ? "error"
        : focused === "password" ? "password" : focused ? "email" : "idle";

    function validate(): Partial<Record<Field, string>> {
        const e: Partial<Record<Field, string>> = {};
        if (!isValidEmail(email) || email.length > 50) e.email = "Enter a valid email (up to 50 characters).";
        if (username.trim().length < 3 || username.trim().length > 20) e.username = "Username must be 3–20 characters.";
        if (password.length < 3 || password.length > 20) e.password = "Password must be 3–20 characters.";
        return e;
    }

    async function signup(ev: React.FormEvent) {
        ev.preventDefault();
        const e = validate();
        setErrors(e);
        if (Object.keys(e).length) {
            setFailed(true);
            setShake((n) => n + 1);
            return;
        }

        setFailed(false);
        setLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                name: username.trim(),
                email: email.trim(),
                password,
            });

            if (res.data.status !== "success") {
                setLoading(false);
                setErrors({ email: res.data.message || "This email is already registered. Try signing in." });
                setFailed(true);
                setShake((n) => n + 1);
                return;
            }

            setLoading(false);
            setSuccess(true);
            toast.success("Account created - sign in to continue.");
            setTimeout(() => navigate("/signin"), reduced ? 0 : 750);
        } catch (err) {
            const response = isAxiosError(err) ? err.response : undefined;
            setLoading(false);
            setFailed(true);
            setShake((n) => n + 1);
            const message = response?.data?.message;
            if (response) setErrors({ email: message || "This email is already registered. Try signing in." });
            else toast.error("Couldn't reach the server. Check your connection and try again.");
        }
    }

    const onType = (field: Field, setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setter(e.target.value);
        setErrors((prev) => ({ ...prev, [field]: undefined }));
        setFailed(false);
        setPulse((n) => n + 1);
    };
    const focusProps = (field: Field) => ({ onFocus: () => setFocused(field), onBlur: () => setFocused(null) });

    return (
        <AuthShell title="Create your account" subtitle="Start preparing for placements in minutes." mood={mood} pulse={pulse} shake={shake}
            switchPrompt={{ text: "Already a member?", label: "Sign in", to: "/signin" }}>
            <form onSubmit={signup} className="space-y-4" noValidate>
                <AuthField label="Email" type="email" placeholder="you@college.edu" autoComplete="email" autoFocus
                    value={email} error={errors.email} onChange={onType("email", setEmail)} {...focusProps("email")} />
                <AuthField label="Username" placeholder="3–20 characters" autoComplete="username"
                    value={username} error={errors.username} onChange={onType("username", setUsername)} {...focusProps("username")} />
                <PasswordField placeholder="3–20 characters" autoComplete="new-password"
                    value={password} error={errors.password} onChange={onType("password", setPassword)} {...focusProps("password")} />
                <div className="pt-1">
                    <AuthSubmit loading={loading} success={success} loadingLabel="Creating account…" successLabel="Account created">
                        Create account
                    </AuthSubmit>
                </div>
            </form>
        </AuthShell>
    );
}
