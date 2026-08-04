import { useRef } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config/config";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export function Signup() {

    const emailRef = useRef<HTMLInputElement>(null);
    const usernameRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();

    async function signup() {
        const email = emailRef.current?.value;
        const username = usernameRef.current?.value;
        const password = passwordRef.current?.value;

        if (!email || !username || !password) {
            toast.error("Please fill in all fields before signing up.");
            return;
        }

        if (email.length < 3 || email.length > 50) {
            toast.error("Email must be between 3 and 50 characters.");
            return;
        }
        if (username.length < 3 || username.length > 20) {
            toast.error("Username must be between 3 and 20 characters.");
            return;
        }
        if (password.length < 3 || password.length > 20) {
            toast.error("Password must be between 3 and 20 characters.");
            return;
        }

        try {
            const res = await axios.post(`${BACKEND_URL}/api/v1/auth/register`, {
                name: username,
                email,
                password,
            });

            if (res.data.status !== "success") {
                toast.error(res.data.message || "This email is already registered. Try logging in.");
                return;
            }

            toast.success("You have signed up successfully!");
            navigate("/signin");
        } catch (err) {
            toast.error("Something went wrong. Try again.");
        }
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center">
            <div className="bg-black border border-white w-95 h-90 rounded-4xl text-white p-6 ring-4 ring-white/90">
                <h1 className="text-center font-poppins font-bold text-2xl">MindPrep AI</h1>
                <h1 className="mt-2 text-center font-poppins font-bold ">An AI Based Placement Preparation Tool </h1>
                <div className="flex flex-col">
                    <input className="flex font-poppins p-2 mt-5 border rounded-lg" placeholder="Enter your Email"
                        ref={emailRef} />
                    <input className="font-poppins p-2 mt-5 border rounded-lg" placeholder="Username"
                        ref={usernameRef} />
                    <input type="password" className="font-poppins p-2 mt-5 border rounded-lg type" placeholder="Password"
                        ref={passwordRef} />
                </div>
                <div className="flex flex-col">
                    <button className="mt-5 bg-white text-black text-md font-poppins font-bold p-2 cursor-pointer border rounded-lg
            transistion duration-200 ease-in-out
            hover:bg-gray-300 active:scale-95"
                        onClick={signup}>
                        Create an account
                    </button>
                </div>
            </div>
        </div>
    );
}
