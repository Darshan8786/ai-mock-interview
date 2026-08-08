import axios from "axios";
import { useRef } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config/config";

export function Signin() {

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function signin() {

    const email = emailRef.current?.value;
    const password = passwordRef.current?.value;

    if (!email || !password) {
      toast.error("Please enter Email and Password");
      return;
    }
    
    try {
      const response = await axios.post(`${BACKEND_URL}/api/v1/auth/login`, {
        email,
        password,
      });

      if (response.data.status !== "success") {
        toast.error(response.data.message || "Incorrect email or password. Try again.");
        return;
      }

      const jwt = response.data.token;
      const role = response.data?.data?.user?.role || "user";
      localStorage.setItem("token", jwt);
      localStorage.setItem("role", role);
      toast.success("Signed in Successfully");
      navigate(role === "admin" ? "/admin" : "/dashboard");
    } catch (err: any) {
      const message = err?.response?.data?.message || "Something went wrong. Try again.";
      toast.error(message);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="bg-black border border-white w-90 h-65 rounded-4xl text-white p-6 ring-4 ring-white/90">
        <h1 className="flex justify-center font-poppins font-bold text-xl">Sign in to your Account</h1>
        <div className="flex flex-col">
          <input className="flex font-poppins p-2 mt-5 border rounded-lg" placeholder="Enter your Email"
            ref={emailRef} />
          <input type="password" className="font-poppins p-2 mt-5 border rounded-lg type" placeholder="Password"
            ref={passwordRef} />
        </div>
        <div className="flex flex-col">
          <button className="mt-5 bg-white text-black text-md font-poppins font-bold p-2 cursor-pointer border rounded-lg
            transistion duration-200 ease-in-out
            hover:bg-gray-300 active:scale-95"
            onClick={signin}>
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
