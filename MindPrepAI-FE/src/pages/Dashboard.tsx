import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { NeuralNetwork3D } from "../components/NeuralNetwork3D";

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

    const features = [
        {
            icon: "📝",
            title: "Quiz Preparation",
            description: "Master placement questions with subject-wise quizzes",
            path: "/quizpage",
            color: "from-purple-500 to-indigo-600",
        },
        {
            icon: "📊",
            title: "Performance Analytics",
            description: "Track your progress and identify weak areas",
            path: "/personalizedreport",
            color: "from-blue-500 to-cyan-600",
        },
        {
            icon: "📄",
            title: "Resume Analyzer",
            description: "Get AI-powered feedback on your resume",
            path: "/resume-analyzer",
            color: "from-orange-500 to-red-600",
        },
        {
            icon: "✨",
            title: "Resume Builder",
            description: "Build an ATS-friendly resume with AI assistance",
            path: "/resume-builder",
            color: "from-emerald-500 to-teal-600",
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
        { label: "Total Users", value: "8+" },
        { label: "Questions Covered", value: "500+" },
        { label: "Success Rate", value: "92%" },
        { label: "Company Wise", value: "5+" },
    ];

    return (
        <div className="min-h-screen bg-black">
            {/* Hero Section with 3D Background */}
            <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 bg-black">
                {/* Background Elements */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse"></div>
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse delay-2000"></div>
                </div>

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
                                <span className="inline-flex items-center rounded-full bg-blue-600/20 px-4 py-2 text-sm font-medium text-blue-300 border border-blue-600/30">
                                    🚀 Your Path to Success
                                </span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                                className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight"
                            >
                                Master Your Placement Interview
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6, delay: 0.3 }}
                                className="mx-auto lg:mx-0 max-w-2xl text-lg text-gray-200 mb-8"
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
                                    onClick={() => navigate("/quizpage")}
                                    className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
                                >
                                    Start Preparing Now
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => navigate("/personalizedreport")}
                                    className="px-8 py-3 rounded-lg bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 transition-all"
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
                            <div className="rounded-2xl overflow-hidden border border-gray-700 bg-gray-900 h-96 shadow-2xl">
                                <NeuralNetwork3D />
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
                className="px-4 py-12 sm:px-6 lg:px-8 bg-black"
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
                            <motion.div
                                key={idx}
                                variants={itemVariants}
                                whileHover={{ y: -5 }}
                                className="rounded-xl bg-gray-900 p-6 border border-gray-700 hover:border-blue-500 transition-all"
                            >
                                <p className="text-gray-300 text-sm font-medium">{stat.label}</p>
                                <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </motion.section>

            {/* Features Section */}
            <section className="px-4 py-16 sm:px-6 lg:px-8 bg-black">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-4xl font-bold text-white mb-4">Powerful Tools for Success</h2>
                        <p className="text-gray-300 text-lg">Everything you need to ace your placement interviews</p>
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
                                whileHover={{ y: -5, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(feature.path)}
                                className="group relative overflow-hidden rounded-2xl bg-gray-900 p-8 transition-all hover:shadow-2xl text-left border border-gray-700 hover:border-blue-500"
                            >
                                <div
                                    className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
                                ></div>

                                <div className="relative">
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="text-5xl mb-4"
                                    >
                                        {feature.icon}
                                    </motion.div>
                                    <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-all">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-300 mb-6">{feature.description}</p>
                                    <div className="flex items-center gap-2 text-blue-400 group-hover:gap-3 transition-all">
                                        <span className="font-semibold">Explore</span>
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
            <section className="px-4 py-16 sm:px-6 lg:px-8 bg-black">
                <div className="mx-auto max-w-6xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="text-center mb-12"
                    >
                        <h2 className="text-4xl font-bold text-white mb-4">Subjects We Cover</h2>
                        <p className="text-gray-300 text-lg">Comprehensive question banks across key technical domains</p>
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
                                className="group cursor-pointer rounded-xl bg-gray-900 p-6 border border-gray-700 hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/20"
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
                                            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                                {subject.name}
                                            </h3>
                                            <p className="text-sm text-gray-400">{subject.count}</p>
                                        </div>
                                    </div>
                                    <motion.span
                                        animate={{ x: [0, 3, 0] }}
                                        transition={{ duration: 1, repeat: Infinity }}
                                        className="text-gray-500 group-hover:text-blue-400 transition-colors"
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
            <section className="relative px-4 py-16 sm:px-6 lg:px-8 bg-black">
                <div className="mx-auto max-w-4xl">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-12 text-center border border-blue-500"
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
                            <h2 className="text-4xl font-bold text-white mb-4">Ready to Transform Your Career?</h2>
                            <p className="text-blue-100 text-lg mb-8">
                                Join thousands of successful candidates who prepared with MindPrep AI and landed their dream jobs.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => navigate("/quizpage")}
                                className="px-8 py-3 rounded-lg bg-white text-blue-700 font-semibold hover:bg-blue-50 transition-all shadow-lg"
                            >
                                Start Your Journey Today
                            </motion.button>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <section className="border-t border-gray-700 px-4 py-12 sm:px-6 lg:px-8 bg-black">
                <div className="mx-auto max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <h3 className="text-white font-bold mb-4">MindPrep AI</h3>
                            <p className="text-gray-400 text-sm">Your complete placement preparation platform</p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Resources</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li><button onClick={() => navigate("/quizpage")} className="hover:text-white transition">Quizzes</button></li>
                                <li><button onClick={() => navigate("/personalizedreport")} className="hover:text-white transition">Analytics</button></li>
                                <li><button onClick={() => navigate("/resume-analyzer")} className="hover:text-white transition">Resume Help</button></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Features</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="hover:text-white transition cursor-pointer">AI Mock Interviews</li>
                                <li className="hover:text-white transition cursor-pointer">Performance Tracking</li>
                                <li className="hover:text-white transition cursor-pointer">Expert Guidance</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="hover:text-white transition cursor-pointer">About Us</li>
                                <li className="hover:text-white transition cursor-pointer">Contact</li>
                                <li className="hover:text-white transition cursor-pointer">Privacy Policy</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-gray-700 pt-8 text-center text-gray-500 text-sm">
                        <p>&copy; 2025 MindPrep AI. All rights reserved. Your journey to success starts here.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
