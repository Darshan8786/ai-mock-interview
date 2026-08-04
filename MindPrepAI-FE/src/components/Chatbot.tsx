import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config/config";

interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
}

interface ChatSource {
    subject: string;
    topic: string;
    accuracy: number;
    similarity: number;
}

interface YouTubeVideo {
    id: string;
    title: string;
    channelTitle: string;
    description: string;
    thumbnailUrl: string;
    videoUrl: string;
    duration: string;
    viewCount: string;
}

interface Documentation {
    name: string;
    url: string;
    description: string;
    type: "official" | "community";
}

interface LearningResource {
    subject: string;
    accuracy: number;
    tutorials: YouTubeVideo[];
    documentation: Documentation[];
}

export function Chatbot() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSources, setShowSources] = useState<ChatSource[] | null>(null);
    const [learningResources, setLearningResources] = useState<LearningResource[]>([]);
    const [showResources, setShowResources] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, showResources]);

    // Fetch learning resources on component mount
    useEffect(() => {
        fetchLearningResources();
    }, []);

    const fetchLearningResources = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const response = await axios.get(
                `${BACKEND_URL}/v1/report/learning-resources`,
                { headers: { token } }
            );

            setLearningResources(response.data.resources || []);
        } catch (err) {
            console.error("Error fetching learning resources:", err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!input.trim()) return;

        // Add user message
        const userMessage: ChatMessage = {
            role: "user",
            content: input,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setLoading(true);
        setError(null);
        setShowSources(null);

        try {
            const token = localStorage.getItem("token");

            if (!token) {
                setError("Authentication required. Please log in.");
                setLoading(false);
                return;
            }

            const response = await axios.post(
                `${BACKEND_URL}/v1/vectordb/chat`,
                { query: input },
                { headers: { token } }
            );

            const assistantMessage: ChatMessage = {
                role: "assistant",
                content: response.data.answer,
                timestamp: Date.now(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setShowSources(response.data.sources || []);
        } catch (err: any) {
            const errorMessage =
                err.response?.data?.error ||
                err.message ||
                "Failed to get response from chatbot";
            setError(errorMessage);

            // Add error message to chat
            const errorChatMessage: ChatMessage = {
                role: "assistant",
                content: `Error: ${errorMessage}`,
                timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorChatMessage]);
        } finally {
            setLoading(false);
        }
    };

    const toggleResources = () => {
        setShowResources(!showResources);
    };

    return (
        <section className="mt-8 rounded-2xl border-2 border-white bg-slate-900 p-6 text-white shadow-lg">
            <div className="mb-6">
                <p className="text-sm text-white/60">Study Assistant</p>
                <h2 className="text-2xl font-bold">Ask Your Study Questions</h2>
                <p className="text-sm text-white/50 mt-1">
                    Our AI assistant has access to your study history and will provide personalized guidance
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {/* Messages Container */}
                <div className="bg-slate-800/50 rounded-xl p-4 h-96 overflow-y-auto flex flex-col gap-3">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-white/50">
                            <div className="text-center">
                                <p className="text-lg font-semibold mb-2">👋 Welcome to Study Assistant</p>
                                <p className="text-sm">Ask questions about your study progress, weak areas, or any topic!</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((message, idx) => (
                                <div
                                    key={idx}
                                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === "user"
                                            ? "bg-indigo-600 text-white"
                                            : "bg-white/10 text-white/90"
                                            }`}
                                    >
                                        <p className="text-sm">{message.content}</p>
                                        <p className="text-xs opacity-50 mt-1">
                                            {new Date(message.timestamp).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div className="flex justify-start">
                                    <div className="bg-white/10 text-white/90 px-4 py-3 rounded-lg">
                                        <div className="flex gap-2 items-center">
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-100"></div>
                                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-200"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Sources */}
                {showSources && showSources.length > 0 && (
                    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3">
                        <p className="text-xs text-indigo-300 font-semibold mb-2">📚 Sources from your study history:</p>
                        <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
                            {showSources.map((source, idx) => (
                                <div key={idx} className="text-xs text-indigo-200 bg-indigo-500/5 p-2 rounded">
                                    <p className="font-semibold">{source.subject} - {source.topic}</p>
                                    <p>Accuracy: {source.accuracy}% | Match: {(source.similarity * 100).toFixed(0)}%</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-xs text-red-300">{error}</p>
                    </div>
                )}

                {/* Learning Resources Toggle */}
                {learningResources.length > 0 && (
                    <button
                        onClick={toggleResources}
                        className="w-full px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-medium hover:from-yellow-700 hover:to-orange-700 transition-all flex items-center justify-center gap-2"
                    >
                        {showResources ? "Hide" : "Show"} 📚 Learning Resources for Weak Areas ({learningResources.length})
                    </button>
                )}

                {/* Learning Resources Section */}
                {showResources && learningResources.length > 0 && (
                    <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/40 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <p className="text-sm font-semibold text-yellow-300 mb-4">📚 Curated Learning Resources for Your Weak Areas</p>

                        {learningResources.map((resource, idx) => (
                            <div key={idx} className="mb-6 last:mb-0 pb-6 last:pb-0 border-b border-yellow-500/20 last:border-b-0">
                                {/* Subject Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-yellow-300 capitalize">{resource.subject}</h3>
                                        <p className="text-sm text-yellow-200">
                                            Current Accuracy: <span className="font-semibold text-red-300">{resource.accuracy}%</span>
                                            <span className="text-xs text-yellow-300 ml-2">⚠️ Needs Improvement</span>
                                        </p>
                                    </div>
                                </div>

                                {/* YouTube Tutorials */}
                                {resource.tutorials.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-semibold text-orange-300 mb-2">🎥 Recommended YouTube Tutorials:</p>
                                        <div className="space-y-2">
                                            {resource.tutorials.map((video, vidIdx) => (
                                                <a
                                                    key={vidIdx}
                                                    href={video.videoUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex gap-2 p-2 rounded bg-slate-800/50 hover:bg-slate-700/70 transition-all group"
                                                >
                                                    <img
                                                        src={video.thumbnailUrl}
                                                        alt={video.title}
                                                        className="w-16 h-12 rounded object-cover flex-shrink-0"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-white group-hover:text-yellow-300 transition-colors line-clamp-2">
                                                            {video.title}
                                                        </p>
                                                        <p className="text-xs text-white/60">
                                                            {video.channelTitle} • {video.duration}
                                                        </p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Documentation Links */}
                                {resource.documentation.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-blue-300 mb-2">📖 Official Documentation & Guides:</p>
                                        <div className="space-y-1">
                                            {resource.documentation.map((doc, docIdx) => (
                                                <a
                                                    key={docIdx}
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-start gap-2 p-2 rounded bg-blue-500/10 hover:bg-blue-500/20 transition-all group"
                                                >
                                                    <span className="text-xs mt-0.5">{doc.type === "official" ? "✅" : "📚"}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-blue-200 group-hover:text-blue-100 transition-colors">
                                                            {doc.name}
                                                        </p>
                                                        <p className="text-xs text-blue-300/80 line-clamp-1">{doc.description}</p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask me anything about your studies..."
                        className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-indigo-500 focus:bg-white/20 transition-all"
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "..." : "Send"}
                    </button>
                </form>

                <p className="text-xs text-white/50 text-center">
                    💡 Tip: Ask about weak areas, topics you struggled with, or how to improve your accuracy
                </p>
            </div>
        </section>
    );
}
