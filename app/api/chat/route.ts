import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Simple in-memory rate limiter: 10 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

function getRateLimitInfo(ip: string) {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return { allowed: true, remaining: RATE_LIMIT - 1 };
    }
    if (entry.count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
    }
    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT - entry.count };
}

export async function POST(request: Request) {
    try {
        // Rate limiting check
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') || 'unknown';
        const { allowed } = getRateLimitInfo(ip);
        if (!allowed) {
            return NextResponse.json(
                { error: "Too many requests. Please wait a minute before trying again." },
                { status: 429 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("GEMINI_API_KEY is missing in environment variables");
            return NextResponse.json({ error: "API key missing" }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { message, history, fileUris } = await request.json();

        // Guard against excessively long messages
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
        }
        if (message.length > 500) {
            return NextResponse.json({ error: "Message too long. Please keep it under 500 characters." }, { status: 400 });
        }

        let knowledgeBaseContent = '';
        try {
            const kbPath = path.join(process.cwd(), 'knowledge.txt');
            knowledgeBaseContent = fs.readFileSync(kbPath, 'utf8');
        } catch (err) {
            console.error('Could not load knowledge base', err);
        }

        const systemPrompt = `You are Kelly, the AI assistant for Devendra Patani's portfolio website. 
Your primary job is to answer questions about Devendra Patani based ONLY on the following professional profile data and Knowledge Base FAQ. 
Be helpful, professional, and concise. Do NOT make up information that, if asked something not in the profile, politely say you don't know but encourage them to contact Devendra directly.

# DEVENDRA PATANI - Professional Profile
Tagline: Operational Excellence Leader • $150M+ P&L Impact
Contact: devgfbpl@gmail.com | +91-9029258727 | linkedin.com/in/devendrapatani | Ahmedabad, Gujarat, India
Specialization: Transforming Operational Chaos into 30-40% Cost Savings for Fortune 500 Companies using AI, Lean Six Sigma, and Digital Transformation.

## Impact & Metrics
- $150M+ Verified P&L Impact
- 30-40% Cost Reduction Avg
- 100+ Enterprise Projects

## The Devendra Method
1. Diagnose The Bleeding: Root Cause Analysis using Process Mining & Advanced Analytics.
2. Stop The Bleeding: Deploy AI + Lean Six Sigma + Intelligent Automation.
3. Build The Profit Engine: Install predictive systems using ML that scale without headcount.

## Professional Experience
- Adani Green Energy (Jun 2024 - Present): Head of Business Excellence. 10+ GW Portfolio, $10B+ Assets. Delivered $5M+ strategic value, 23% revenue growth, 22% EBITDA expansion. Zero non-conformity across 8 ISO standards. 40% cycle time reduction via intelligent automation.
- Mahindra Finance (Apr 2021 - Jun 2024): Deputy VP Business Excellence. Delivered ₹200 Crore+ cost savings, 91% cycle time reduction via AI/ML. Built 150+ Lean Six Sigma professionals. 81% accuracy loan default prediction using ML.
- Maersk Global Service Centres (Mar 2014 - Feb 2016): Process Excellence Manager. $35M+ cost savings, 40% cycle time reduction. 35% on-time delivery improvement.
- PepsiCo India (Dec 2009 - Dec 2010): Assistant Manager Manufacturing. Commissioned India's fastest 600 BPM CSD line at 99.3% efficiency.

## Core Expertise
Operational Excellence, AI/ML Implementation, Lean Six Sigma (MBB), Digital Transformation, Process Mining, RPA & Automation, Advanced Analytics, Supply Chain Optimization.

## Education & Certifications
- Executive MBA - International Business (The ICFAI University, 2011-2013)
- Bachelor of Engineering - Industrial Engineering (North Maharashtra University, 1996-2000)
- Certifications: Six Sigma Master Black Belt (IISI), AI Journalist, IBM Data Science Specialization, Prompt Engineering (Vanderbilt), Machine Learning (Stanford).

## Awards
- 2025 Best Leader - Business Excellence (Adani Green)
- 2021 Quality Leader of the Year (Mahindra Rise)
- 2018 The Mahindra Way Award

## Knowledge Base FAQ
${knowledgeBaseContent}
`;

        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });

        // Construct history for startChat
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chatHistory = (history || []).map((msg: any) => ({
            role: msg.role === 'model' ? 'model' : 'user',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            parts: msg.parts.map((part: any) => ({ text: part.text }))
        }));

        // Gemini API requires history to start with a user message.
        // Our frontend includes a welcome message from the model, we filter it out here.
        while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
            chatHistory.shift();
        }

        // Start chat session
        const chat = model.startChat({
            history: chatHistory,
        });

        // Send message with file context if available
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messageParts: any[] = [{ text: message }];

        if (fileUris && fileUris.length > 0) {
            fileUris.forEach((uri: string) => {
                messageParts.push({
                    fileData: {
                        mimeType: "application/pdf",
                        fileUri: uri
                    }
                });
            });
        }

        const result = await chat.sendMessageStream(messageParts);

        // Create stream response
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        controller.enqueue(encoder.encode(chunkText));
                    }
                } catch (err) {
                    console.error("Streaming error", err);
                    controller.error(err);
                } finally {
                    controller.close();
                }
            },
        });

        return new NextResponse(stream);

    } catch (error: any) {
        console.error("Chat error details:", error);
        return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
    }
}
