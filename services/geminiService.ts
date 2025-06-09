
import { GoogleGenAI, Chat, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import { AI_SYSTEM_PROMPT } from '../constants';
import { ChatMessage, AIProjectStructure, ModelId } from "../types";

let ai: GoogleGenAI | null = null;
let activeChatSession: Chat | null = null;
let currentModelId: ModelId | null = null;


const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        if (!process.env.API_KEY) {
            console.error("API_KEY environment variable not set.");
            alert("Gemini API Key is not configured. Please set the process.env.API_KEY environment variable.");
            throw new Error("API_KEY environment variable not set.");
        }
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
        // Consider if history in the GenAI Chat object needs to be explicitly synced
        // if messages were added/removed outside of sendMessage calls on this session.
        // For now, this is okay as `resetChatSession` is called on major context changes.
        return activeChatSession;
    }

    console.log(`Creating new chat session for model: ${modelId}`);
    const client = getAiClient();
    // Only pass user/model messages for history. System prompt is separate.
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

        // First, try to extract content from ```json ... ``` or ``` ... ```
        const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
        const fenceMatch = jsonStringToParse.match(fenceRegex);

        if (fenceMatch && fenceMatch[1]) {
            jsonStringToParse = fenceMatch[1].trim();
        } else {
            const firstBrace = jsonStringToParse.indexOf('{');
            const lastBrace = jsonStringToParse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                jsonStringToParse = jsonStringToParse.substring(firstBrace, lastBrace + 1).trim();
            }
        }

        // Attempt to fix a common issue: a newline character immediately before the final closing brace or bracket.
        let originalJsonStringForLog = jsonStringToParse;
        let modifiedForParsing = false;

        if (jsonStringToParse.endsWith('\n}')) {
            jsonStringToParse = jsonStringToParse.slice(0, -2) + '}';
            modifiedForParsing = true;
        } else if (jsonStringToParse.endsWith('\n]')) {
            jsonStringToParse = jsonStringToParse.slice(0, -2) + ']';
            modifiedForParsing = true;
        }

        if (modifiedForParsing) {
            console.warn(`Attempted to fix JSON string ending with newline before brace/bracket. Original (last 30 chars): "...${originalJsonStringForLog.slice(-30)}". New (last 30 chars): "...${jsonStringToParse.slice(-30)}"`);
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
            console.error("String attempted to be parsed (after extraction and potential fix):", jsonStringToParse);
            return {
                files: { "error.txt": `Failed to parse AI response. This usually means the JSON was malformed (e.g., unescaped quotes, backslashes, or newlines in code). Error: ${parseError.message}. Raw text (first 500 chars): ${rawText.substring(0,500)}...` },
                aiMessage: "I seem to have made a mistake in formatting my last response as valid JSON. This often happens with unescaped characters like quotes (\"), backslashes (\\), or newlines (\\n) within the code I generate. Please ensure all strings, especially code, are perfectly escaped. I'll try to be more careful. Could you please repeat your last request? The console might have more details about the malformed JSON."
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
