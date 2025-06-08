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
        
        let jsonStr = rawText.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        try {
            const parsedResponse = JSON.parse(jsonStr) as AIProjectStructure;
            if (typeof parsedResponse.files === 'object' && parsedResponse.files !== null && typeof parsedResponse.aiMessage === 'string') {
                return parsedResponse;
            } else {
                console.error("AI response parsed but missing required fields (files, aiMessage). Response:", parsedResponse);
                // Log the problematic string for easier debugging
                console.error("Problematic JSON string that was parsed (but failed validation):", jsonStr);
                return {
                    files: { "error.txt": `AI response format error. Expected 'files' object and 'aiMessage' string. Got: ${jsonStr.substring(0,500)}...` },
                    aiMessage: "I'm having trouble formatting my response correctly. It seems some expected parts are missing. Please check the console for details or try again."
                };
            }
        } catch (parseError: any) {
            console.error("Failed to parse AI response as JSON:", parseError.message);
            console.error("Raw AI response text (from result.text):", rawText);
            console.error("String attempted to be parsed (after fence removal):", jsonStr); // Log the string that failed
            return {
                files: { "error.txt": `Failed to parse AI response. Error: ${parseError.message}. Raw text (first 500 chars): ${rawText.substring(0,500)}...` },
                aiMessage: "Sorry, I couldn't understand the structure of my last thought. Please try rephrasing your request or check the console for technical details about the parsing error."
            };
        }

    } catch (error) {
        console.error("Error sending message to AI or processing its response:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        // Consider if session should be reset on all errors.
        // For some errors (e.g. network), retrying might be fine. For others (e.g. auth), reset is needed.
        // if (error is critical auth/quota error) resetChatSession(); 
        return {
            files: { "error.txt": `Error from AI service: ${errorMessage}` },
            aiMessage: `Oops! I encountered an issue: ${errorMessage}. The chat session might be affected. Try sending your message again, or if the problem persists, check the console.`
        };
    }
};