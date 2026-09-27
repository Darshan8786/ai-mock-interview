import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BACKEND_URL } from "../../config/config";
import { TextInput, Field } from "../../components/admin/Inputs";
import { Button } from "../../components/admin/Button";

export function AdminSignin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter your email and password");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
        email,
        password,
      });

      if (response.data.status !== "success") {
        toast.error(response.data.message || "Incorrect email or password.");
        return;
      }

      const role = response.data?.data?.user?.role || "user";
      if (role !== "admin") {
        toast.error("This account does not have admin access.");
        return;
      }

      localStorage.setItem("adminToken", response.data.token);
      localStorage.setItem("adminRole", role);
      toast.success("Admin signed in successfully");
      navigate("/admin");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 text-white relative overflow-hidden">
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-white/10" />
        <div className="absolute -left-16 bottom-10 w-72 h-72 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center">
            <span className="font-bold text-lg">M</span>
          </div>
          <span className="font-semibold text-lg">MindPrep AI</span>
        </div>
        <div className="relative">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Placement admin,<br />all in one place.</h2>
          <p className="mt-4 text-indigo-100 max-w-md">
            Track student readiness, run drives, manage jobs and alumni openings, and export placement reports.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-md">
            {["Students", "Jobs & drives", "Reports"].map((t) => (
              <div key={t} className="rounded-xl bg-white/10 ring-1 ring-white/15 px-3 py-3 text-sm text-indigo-50">{t}</div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-indigo-200">© {new Date().getFullYear()} MindPrep AI</p>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50 lg:bg-white">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-bold">M</span>
            </div>
            <span className="font-semibold text-slate-900">MindPrep AI</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Sign in to Admin</h1>
          <p className="text-sm text-slate-500 mt-1.5 mb-8">Use your placement-cell admin account.</p>

          <form onSubmit={signin} className="space-y-4">
            <Field label="Email">
              <TextInput
                type="email"
                placeholder="admin@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>

            <Button type="submit" loading={loading} className="w-full !py-2.5">
              Sign in
            </Button>
          </form>

          <button
            onClick={() => navigate("/signin")}
            className="mt-8 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
          >
            ← Student sign in
          </button>
        </motion.div>
      </div>
    </div>
  );
}
