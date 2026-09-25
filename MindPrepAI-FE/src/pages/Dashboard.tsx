import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState, lazy, Suspense } from "react";
import { FloatingCard } from "../components/3d/FloatingCard";
import { getMyNotifications, type StudentNotification } from "../services/notificationsApi";

// Code-split: three.js + @react-three/fiber only load on pages that render 3D.
const DashboardOrbScene = lazy(() => import("../components/3d/DashboardOrbScene"));

// Dashboard component with 3D visualizations and animations

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.6,
        },
    },
};

export function Dashboard() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<StudentNotification[]>([]);

    useEffect(() => {
        getMyNotifications()
            .then((res) => setNotifications(res.notifications.filter((n) => !n.read).slice(0, 4)))
            .catch(() => {});
    }, []);

    const features = [
        {
            icon: "📊",
            title: "Performance Analytics",
            description: "Track your progress and identify weak areas",
            path: "/personalizedreport",
            color: "from-blue-500 to-cyan-500",
        },
        {
            icon: "📄",
            title: "Resume Analyzer",
            description: "Get AI-powered feedback on your resume",
            path: "/resume-analyzer",
            color: "from-orange-500 to-rose-500",
        },
        {
            icon: "✨",
            title: "Resume Builder",
            description: "Build an ATS-friendly resume with AI assistance",
            path: "/resume-builder",
            color: "from-emerald-500 to-teal-500",
        },
        {
            icon: "💼",
            title: "Job Opportunities",
            description: "Browse placement drives and apply for jobs",
            path: "/jobs",
            color: "from-indigo-500 to-violet-500",
        },
        {
            icon: "📋",
            title: "My Applications",
            description: "Track the status of your job applications",
            path: "/my-applications",
            color: "from-fuchsia-500 to-pink-500",
        },
    ];

    const subjects = [
        { name: "DBMS", count: "25 Questions", icon: "🗄️" },
        { name: "OOPS", count: "30 Questions", icon: "🏗️" },
        { name: "Java Full Stack", count: "45 Questions", icon: "☕" },
        { name: "OS", count: "20 Questions", icon: "⚙️" },
        { name: "DSA", count: "50 Questions", icon: "📐" },
        { name: "SQL", count: "35 Questions", icon: "📚" },
    ];

    const stats = [
        { label: "Total Users", value: "8+", icon: "👥" },
        { label: "Questions Covered", value: "500+", icon: "❓" },
        { label: "Success Rate", value: "92%", icon: "🎯" },
        { label: "Company Wise", value: "5+", icon: "🏢" },
    ];

    return (
        <div className="min-h-screen">
            {/* Hero Section */}
            <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
                <div className="relative mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                        {/* Left Content */}
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="text-center lg:text-left"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6, delay: 0.1 }}
                                className="inline-block mb-6"
                            >
                                <span className="inline-flex items-center rounded-full glass px-4 py-2 text-sm font-medium text-violet-300">
                                    🚀 Your Path to Success
                                </span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-5xl sm:text-6xl font-bold font-poppins mb-6 leading-tight"
                            >
                                <span className="text-white">Master Your </span>
                                <span className="gradient-text">Placement Interview</span>
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="mx-auto lg:mx-0 max-w-2xl text-lg text-gray-300 mb-8"
                            >
                                Prepare with our comprehensive platform featuring AI-powered mock interviews, performance analytics, and industry-curated questions to land your dream job.
                            </motion.p>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.4 }}
                                className="flex flex-col sm:flex-row gap-4"
                            >
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate("/aptitude")}
                                    className="px-8 py-3 rounded-full btn-gradient font-semibold"
                                >
                                    Start Preparing Now
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate("/personalizedreport")}
                                    className="px-8 py-3 rounded-full glass glass-hover text-white font-semibold"
                                >
                                    View Your Progress
                                </motion.button>
                            </motion.div>
                        </motion.div>

                        {/* Right 3D Content */}
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8 }}
                            className="hidden lg:block"
                        >
                            <div className="rounded-3xl overflow-hidden glass gradient-border h-96 shadow-2xl">
                                <Suspense fallback={<div className="w-full h-full bg-gradient-to-br from-violet-600/10 via-fuchsia-600/5 to-cyan-500/5 animate-pulse" />}>
                                    <DashboardOrbScene />
                                </Suspense>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <motion.section
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="px-4 py-12 sm:px-6 lg:px-8"
            >
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-2 md:grid-cols-4 gap-4"
                    >
                        {stats.map((stat, idx) => (
                            <motion.div key={idx} variants={itemVariants} whileHover={{ y: -5 }}>
                                <FloatingCard className="rounded-2xl glass glass-hover p-6">
                                    <span className="text-2xl">{stat.icon}</span>
                                    <p className="text-gray-400 text-sm font-medium mt-2">{stat.label}</p>
                                    <p className="text-3xl font-bold text-white mt-1 font-poppins">{stat.value}</p>
                                </FloatingCard>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </motion.section>

            {/* Notifications Section */}
            {notifications.length > 0 && (
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="px-4 py-10 sm:px-6 lg:px-8"
                >
                    <div className="mx-auto max-w-6xl">
                        <div className="rounded-3xl glass p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white font-poppins">🔔 Notifications</h2>
                                <button
                                    onClick={() => navigate("/jobs")}
                                    className="text-sm text-violet-300 hover:text-violet-200 hover:underline font-medium"
                                >
                                    View all →
                                </button>
                            </div>
                            <div className="space-y-3">
                                {notifications.map((n) => (
                                    <button
                                        key={n.id}
                                        onClick={() => n.job?.id && navigate(`/jobs/${n.job.id}`)}
                                        className="w-full text-left flex items-start gap-3 rounded-2xl glass glass-hover p-4"
                                    >
                                        <span className="mt-1.5 w-2 h-2 rounded-full bg-fuchsia-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-white font-medium text-sm">{n.title}</p>
                                            <p className="text-gray-400 text-sm mt-0.5 line-clamp-2">{n.body}</p>
                                            {n.job && (
                                                <p className="text-xs text-violet-300 mt-1.5 font-medium">
                                                    {n.job.companyName} • {n.job.jobTitle} • View details →
                                                </p>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.section>
            )}

            {/* Features Section */}
            <section className="px-4 py-16 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-4xl font-bold font-poppins mb-4">
                            <span className="gradient-text">Powerful Tools</span> <span className="text-white">for Success</span>
                        </h2>
                        <p className="text-gray-400 text-lg">Everything you need to ace your placement interviews</p>
                    </motion.div>

                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
                    >
                        {features.map((feature, idx) => (
                            <motion.button
                                key={idx}
                                variants={itemVariants}
                                whileHover={{ y: -6, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(feature.path)}
                                className="group relative overflow-hidden rounded-2xl glass glass-hover p-8 text-left"
                            >
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                                ></div>

                                <div className="relative">
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className={`w-14 h-14 mb-4 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl shadow-lg`}
                                    >
                                        {feature.icon}
                                    </motion.div>
                                    <h3 className="text-xl font-bold text-white mb-3 font-poppins group-hover:text-violet-300 transition-all">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-400 mb-6 text-sm">{feature.description}</p>
                                    <div className="flex items-center gap-2 text-violet-300 group-hover:gap-3 transition-all">
                                        <span className="font-semibold text-sm">Explore</span>
                                        <motion.span
                                            animate={{ x: [0, 5, 0] }}
                                            transition={{ duration: 1.5, repeat: Infinity }}
                                        >
                                            →
                                        </motion.span>
                                    </div>
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* Subjects Section */}
            <section className="px-4 py-16 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-4xl font-bold font-poppins mb-4 text-white">Subjects We Cover</h2>
                        <p className="text-gray-400 text-lg">Comprehensive question banks across key technical domains</p>
                    </motion.div>

                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    >
                        {subjects.map((subject, idx) => (
                            <motion.div
                                key={idx}
                                variants={itemVariants}
                                whileHover={{ scale: 1.02 }}
                                className="group cursor-pointer rounded-2xl glass glass-hover p-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <motion.span
                                            animate={{ scale: [1, 1.1, 1] }}
                                            transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                                            className="text-4xl"
                                        >
                                            {subject.icon}
                                        </motion.span>
                                        <div>
                                            <h3 className="text-xl font-bold text-white group-hover:text-violet-300 transition-colors font-poppins">
                                                {subject.name}
                                            </h3>
                                            <p className="text-sm text-gray-400">{subject.count}</p>
                                        </div>
                                    </div>
                                    <motion.span
                                        animate={{ x: [0, 3, 0] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="text-gray-500 group-hover:text-violet-300 transition-colors"
                                    >
                                        →
                                    </motion.span>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative px-4 py-16 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden rounded-3xl p-12 text-center"
                        style={{
                            backgroundImage: "linear-gradient(135deg, #4f46e5, #9333ea, #db2777)",
                        }}
                    >
                        {/* Animated background */}
                        <div className="absolute inset-0 overflow-hidden">
                            <motion.div
                                animate={{ x: [-100, 100], y: [-100, 100] }}
                                transition={{ duration: 8, repeat: Infinity, repeatType: 'mirror' }}
                                className="absolute -top-20 -right-20 w-40 h-40 bg-white rounded-full mix-blend-screen opacity-10"
                            ></motion.div>
                            <motion.div
                                animate={{ x: [100, -100], y: [100, -100] }}
                                transition={{ duration: 10, repeat: Infinity, repeatType: 'mirror' }}
                                className="absolute -bottom-20 -left-20 w-40 h-40 bg-white rounded-full mix-blend-screen opacity-10"
                            ></motion.div>
                        </div>

                        <div className="relative">
                            <h2 className="text-4xl font-bold text-white mb-4 font-poppins">Ready to Transform Your Career?</h2>
                            <p className="text-white/80 text-lg mb-8">
                                Join thousands of successful candidates who prepared with MindPrep AI and landed their dream jobs.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate("/aptitude")}
                                className="px-8 py-3 rounded-full bg-white text-violet-700 font-semibold hover:bg-violet-50 transition-all shadow-lg"
                            >
                                Start Your Journey Today
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <section className="border-t border-white/10 px-4 py-12 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-white font-bold mb-4 font-poppins">MindPrep AI</h3>
                            <p className="text-gray-400 text-sm">Your complete placement preparation platform</p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Resources</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><button onClick={() => navigate("/aptitude")} className="hover:text-violet-300 transition">Aptitude</button></li>
                                <li><button onClick={() => navigate("/personalizedreport")} className="hover:text-violet-300 transition">Analytics</button></li>
                                <li><button onClick={() => navigate("/resume-analyzer")} className="hover:text-violet-300 transition">Resume Help</button></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Features</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="hover:text-violet-300 transition cursor-pointer">AI Mock Interviews</li>
                                <li className="hover:text-violet-300 transition cursor-pointer">Performance Tracking</li>
                                <li className="hover:text-violet-300 transition cursor-pointer">Expert Guidance</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="hover:text-violet-300 transition cursor-pointer">About Us</li>
                                <li className="hover:text-violet-300 transition cursor-pointer">Contact</li>
                                <li className="hover:text-violet-300 transition cursor-pointer">Privacy Policy</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
                        <p>&copy; 2025 MindPrep AI. All rights reserved. Your journey to success starts here.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
