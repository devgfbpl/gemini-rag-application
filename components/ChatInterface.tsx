'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Send, Menu, Sparkles, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface FileData {
    uri: string;
    name: string;
    status: 'uploading' | 'processing' | 'active' | 'failed';
}

interface Message {
    role: 'user' | 'model';
    text: string;
    citations?: string[];
}

interface ChatInterfaceProps {
    user: any;
    signOutButton: React.ReactNode;
}

export default function ChatInterface({ user, signOutButton }: ChatInterfaceProps) {
    const [files, setFiles] = useState<FileData[]>([]);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: `Hello ${user?.name || 'there'}! I'm ready to help you analyze your documents. Upload a PDF to get started.` }
    ]);
    const [inputText, setInputText] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const tempId = URL.createObjectURL(file);
        const newFile: FileData = {
            uri: tempId, // Temporary URI
            name: file.name,
            status: 'uploading'
        };

        setFiles(prev => [...prev, newFile]);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/files', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const data = await response.json();

            setFiles(prev => prev.map(f =>
                f.uri === tempId ? { ...f, uri: data.uri, status: 'active' } : f
            ));
        } catch (error) {
            console.error(error);
            setFiles(prev => prev.map(f =>
                f.uri === tempId ? { ...f, status: 'failed' } : f
            ));
        }
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: Message = { role: 'user', text: inputText };
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            const activeFileUris = files.filter(f => f.status === 'active').map(f => f.uri);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage.text,
                    history: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
                    fileUris: activeFileUris
                })
            });

            if (!response.ok) throw new Error('Failed to send message');

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No reader available');

            let accumulatedText = '';
            const decoder = new TextDecoder();

            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                accumulatedText += chunk;

                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'model') {
                        lastMessage.text = accumulatedText;
                    }
                    return newMessages;
                });
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "I'm sorry, I encountered an error. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="flex h-screen bg-[#09090b] text-slate-100 font-sans overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <motion.aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[300px] bg-[#09090b] border-r border-[#3c83f6]/20 flex flex-col transition-transform duration-300 md:relative md:translate-x-0",
                    isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                <div className="p-6 border-b border-[#3c83f6]/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#ccff00]">
                        <FileText className="w-6 h-6" />
                        <h1 className="font-bold tracking-tight text-lg">Gemini Files</h1>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-y-auto">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-[#3c83f6]/30 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#3c83f6]/5 cursor-pointer hover:bg-[#3c83f6]/10 transition-colors group"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf,.txt,.md" // Add more accepted types if needed
                            onChange={handleFileUpload}
                        />
                        <div className="w-12 h-12 rounded-full bg-[#3c83f6]/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Upload className="w-6 h-6 text-[#3c83f6]" />
                        </div>
                        <p className="text-sm text-slate-400 group-hover:text-[#3c83f6] transition-colors">Drag or click to upload</p>
                        <p className="text-xs text-slate-600 mt-1">PDF, TXT up to 10MB</p>
                    </div>

                    <div className="mt-6 space-y-3">
                        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">Knowledge Base</h3>
                        {files.length === 0 && (
                            <div className="text-center py-8 text-slate-600 text-sm italic">
                                No files uploaded yet.
                            </div>
                        )}
                        {files.map((file) => (
                            <div key={file.uri} className="group relative p-3 rounded-lg bg-white/5 border border-white/5 hover:border-[#3c83f6]/30 transition-all flex items-center gap-3">
                                <div className="w-8 h-8 rounded bg-[#ccff00]/10 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-[#ccff00]" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate text-slate-200">{file.name}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className={cn(
                                            "w-1.5 h-1.5 rounded-full",
                                            file.status === 'active' && "bg-[#ccff00] animate-pulse",
                                            file.status === 'processing' && "bg-[#3c83f6] animate-bounce",
                                            file.status === 'failed' && "bg-red-500",
                                            file.status === 'uploading' && "bg-yellow-500"
                                        )} />
                                        <span className={cn(
                                            "text-[10px] uppercase font-bold tracking-wide",
                                            file.status === 'active' && "text-[#ccff00]",
                                            file.status === 'processing' && "text-[#3c83f6]",
                                            file.status === 'failed' && "text-red-500",
                                            file.status === 'uploading' && "text-yellow-500"
                                        )}>
                                            {file.status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative bg-[#09090b]">
                {/* Header */}
                <header className="h-16 px-6 border-b border-[#3c83f6]/10 flex items-center justify-between bg-[#09090b]/80 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-[#3c83f6]">
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-medium text-white flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-[#ccff00]" />
                            Chat
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {signOutButton}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3c83f6] to-[#ccff00] p-[1px]">
                            {user?.image ? (
                                <img src={user.image} alt={user.name || 'User'} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <div className="w-full h-full rounded-full bg-[#09090b] flex items-center justify-center">
                                    <span className="text-xs font-bold text-white uppercase">{user?.name?.[0] || 'U'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                    {messages.map((msg, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                                "flex gap-4 max-w-3xl mx-auto",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-lg bg-[#3c83f6]/10 border border-[#3c83f6]/20 flex items-center justify-center shrink-0 mt-1">
                                    <Sparkles className="w-4 h-4 text-[#3c83f6]" />
                                </div>
                            )}

                            <div className={cn(
                                "rounded-2xl p-4 max-w-[85%] md:max-w-[75%] space-y-2 shadow-lg",
                                msg.role === 'user'
                                    ? "bg-[#3c83f6] text-white rounded-br-sm"
                                    : "bg-white/5 border border-white/5 backdrop-blur-sm rounded-tl-sm text-slate-200"
                            )}>
                                <p className="leading-relaxed whitespace-pre-wrap text-sm md:text-base">
                                    {msg.text}
                                </p>
                                {msg.citations && msg.citations.length > 0 && (
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        {msg.citations.map((cite, i) => (
                                            <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded border border-white/10 text-slate-400">
                                                {cite}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 border border-[#ccff00]/20 flex items-center justify-center shrink-0 mt-1">
                                    <div className="w-4 h-4 rounded-full bg-[#ccff00]" />
                                </div>
                            )}
                        </motion.div>
                    ))}

                    {isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex gap-4 max-w-3xl mx-auto justify-start"
                        >
                            <div className="w-8 h-8 rounded-lg bg-[#3c83f6]/10 border border-[#3c83f6]/20 flex items-center justify-center shrink-0">
                                <Loader2 className="w-4 h-4 text-[#3c83f6] animate-spin" />
                            </div>
                            <div className="flex items-center gap-1 text-slate-500 text-sm h-8">
                                Thinking...
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#09090b]/90 border-t border-[#3c83f6]/10 backdrop-blur-xl">
                    <div className="max-w-3xl mx-auto relative group">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Ask anything about your documents..."
                            disabled={isLoading}
                            className="w-full bg-white/5 border border-white/10 focus:border-[#3c83f6] focus:ring-1 focus:ring-[#3c83f6] rounded-full py-3.5 pl-6 pr-14 text-sm text-white placeholder:text-slate-500 outline-none transition-all disabled:opacity-50"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!inputText.trim() || isLoading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#3c83f6] hover:bg-[#2563eb] rounded-full flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#3c83f6]/20 active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-slate-600 mt-3">
                        Gemini RAG • End-to-end encrypted
                    </p>
                </div>
            </main>
        </div>
    );
}
