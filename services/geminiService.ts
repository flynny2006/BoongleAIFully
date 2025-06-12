
import { GoogleGenAI, Chat, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import { AI_SYSTEM_PROMPT } from '../constants';
import { ChatMessage, AIProjectStructure, ModelId } from "../types";

let ai: GoogleGenAI | null = null;
let activeChatSession: Chat | null = null;
let currentModelId: ModelId | null = null;

// const USER_SET_API_KEY_LS_KEY = 'GEMINI_API_KEY_USER_SET'; // Removed

const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        // API key MUST be obtained exclusively from the environment variable process.env.API_KEY
        if (!process.env.API_KEY || process.env.API_KEY.trim() === '') {
            console.error("Gemini API Key (process.env.API_KEY) is not configured. Please ensure this environment variable is set.");
            // Alerting the user can be disruptive in a library, but for this app's context it might be intended.
            alert("CRITICAL: Gemini API Key (process.env.API_KEY) is not configured. AI features will not work.");
            throw new Error("Gemini API Key not configured in process.env.API_KEY.");
        }
        
        console.info(`Using Gemini API Key from: environment variable (process.env.API_KEY)`);
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

const convertMessagesToGenAiHistory = (messages: ChatMessage[]): Content[] => {
    return messages.map(msg => {
        if (msg.sender === 'system') return null; // System messages are handled by systemInstruction
        return {
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        };
    }).filter(Boolean) as Content[];
};


export const getOrCreateChatSession = (chatHistory: ChatMessage[], modelId: ModelId): Chat => {
    if (activeChatSession && currentModelId === modelId) {
        // TODO: Potentially update history if needed, but GenAI's Chat object handles this.
        // For now, assume if session exists for model, it's current.
        return activeChatSession;
    }

    console.log(`Creating new chat session for model: ${modelId}`);
    const client = getAiClient(); // This will now throw if API_KEY is not in process.env
    const genAiHistory = convertMessagesToGenAiHistory(chatHistory.filter(m => m.sender !== 'system'));
    currentModelId = modelId;

    activeChatSession = client.chats.create({
        model: modelId,
        config: {
            systemInstruction: AI_SYSTEM_PROMPT,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ],
        },
        history: genAiHistory,
    });
    return activeChatSession;
};

export const resetChatSession = () => {
    console.log("Resetting active chat session.");
    activeChatSession = null;
    currentModelId = null;
};

export const sendMessageToAI = async (chat: Chat, message: string, modelIdUsed?: ModelId): Promise<AIProjectStructure> => {
    try {
        const result: GenerateContentResponse = await chat.sendMessage({ message });
        const rawText = result.text;

        let jsonStringToParse = rawText.trim();

        const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
        const fenceMatch = jsonStringToParse.match(fenceRegex);

        if (fenceMatch && fenceMatch[1]) {
            jsonStringToParse = fenceMatch[1].trim(); 

            if (!(jsonStringToParse.startsWith('{') && jsonStringToParse.endsWith('}'))) {
                const firstBrace = jsonStringToParse.indexOf('{');
                const lastBrace = jsonStringToParse.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace > firstBrace) {
                    const candidate = jsonStringToParse.substring(firstBrace, lastBrace + 1);
                    if (candidate.startsWith('{') && candidate.endsWith('}')) {
                        console.warn(`Cleaned potentially malformed JSON string by isolating content between first '{' and last '}'. Original from fence (trimmed, ends with "...${jsonStringToParse.slice(-50)}"). New (ends with "...${candidate.slice(-50)}")`);
                        jsonStringToParse = candidate;
                    } else {
                         console.warn(`Could not reliably isolate a clean JSON object from fence content: "${jsonStringToParse.substring(0,100)}..."`);
                    }
                } else {
                     console.warn(`Fence content, after initial trim, did not appear to contain a main JSON object structure: "${jsonStringToParse.substring(0,100)}..."`);
                }
            }
        } else {
            const firstBrace = jsonStringToParse.indexOf('{');
            const lastBrace = jsonStringToParse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonStringToParse = jsonStringToParse.substring(firstBrace, lastBrace + 1).trim();
            }
        }

        let originalJsonStringForLog = jsonStringToParse; 
        let modifiedByNewlineFix = false;

        if (jsonStringToParse.endsWith('\n}')) {
            jsonStringToParse = jsonStringToParse.slice(0, -2) + '}';
            modifiedByNewlineFix = true;
        } 

        if (modifiedByNewlineFix) {
            console.warn(`Attempted to fix JSON string ending with newline before brace. Original (last 30 chars): "...${originalJsonStringForLog.slice(-30)}". New (last 30 chars): "...${jsonStringToParse.slice(-30)}"`);
        }

        try {
            const parsedResponse = JSON.parse(jsonStringToParse) as AIProjectStructure;
            if (typeof parsedResponse.files === 'object' && parsedResponse.files !== null && typeof parsedResponse.aiMessage === 'string') {
                return parsedResponse;
            } else {
                console.error("AI response parsed but missing required fields (files, aiMessage). Response:", parsedResponse);
                console.error("Original raw AI response text:", rawText);
                console.error("String that was parsed (but failed validation):", jsonStringToParse);
                return {
                    files: { "error.txt": `AI response format error. Expected 'files' object and 'aiMessage' string. Got: ${jsonStringToParse.substring(0,500)}...` },
                    aiMessage: "I'm having trouble formatting my response correctly. It seems some expected parts are missing. Please check the console for details or try again."
                };
            }
        } catch (parseError: any) {
            console.error("Failed to parse AI response as JSON:", parseError.message);
            console.error("Original raw AI response text:", rawText);
            console.error("String attempted to be parsed (after extraction and potential fixes):", jsonStringToParse);
            return {
                files: { "error.txt": `Failed to parse AI response. This usually means the JSON was malformed (e.g., unescaped quotes, backslashes, or newlines in code, or extraneous characters). Error: ${parseError.message}. Raw text (first 500 chars): ${rawText.substring(0,500)}...` },
                aiMessage: "I seem to have made a mistake in formatting my last response as valid JSON. This can happen with unescaped characters or if extra text was accidentally included. I'll try to be more careful. Could you please repeat your last request? The console might have more details about the malformed JSON."
            };
        }

    } catch (error) {
        console.error("Error sending message to AI or processing its response:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return {
            files: { "error.txt": `Error from AI service: ${errorMessage}` },
            aiMessage: `Oops! I encountered an issue: ${errorMessage}. The chat session might be affected. Try sending your message again, or if the problem persists, check the console.`
        };
    }
};
