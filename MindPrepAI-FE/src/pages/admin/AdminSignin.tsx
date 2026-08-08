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

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("role", role);
      toast.success("Admin signed in successfully");
      navigate("/admin");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_60%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-gray-900/80 backdrop-blur border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
              <span className="text-white font-bold text-2xl">M</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin Console</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to MindPrep AI admin dashboard</p>
          </div>

          <form onSubmit={signin} className="space-y-4">
            <Field label="Email">
              <TextInput
                type="email"
                placeholder="admin@mindprep.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <TextInput
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign In to Dashboard
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <button
              onClick={() => navigate("/signin")}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Back to student sign in
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
