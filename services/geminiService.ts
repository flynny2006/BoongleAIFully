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
        if (msg.sender === 'system') return null;
        return {
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        };
    }).filter(Boolean) as Content[];
};


export const getOrCreateChatSession = (chatHistory: ChatMessage[], modelId: ModelId): Chat => {
    // If activeChatSession exists AND it's for the current modelId, reuse it.
    // Otherwise, create a new one. This handles model switching.
    if (activeChatSession && currentModelId === modelId) {
        // Potentially update history if needed, though GenAI's Chat object handles this internally for sendMessage.
        // For now, if session exists for model, assume it's current.
        return activeChatSession;
    }
    
    console.log(`Creating new chat session for model: ${modelId}`);
    const client = getAiClient();
    const genAiHistory = convertMessagesToGenAiHistory(chatHistory);
    currentModelId = modelId; // Update the current model ID

    activeChatSession = client.chats.create({
        model: modelId, // Use the passed modelId
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

// Call this when the project fundamentally changes (new project, model switch, version restore)
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
                return {
                    files: { "error.txt": `AI response format error. Expected 'files' object and 'aiMessage' string. Got: ${jsonStr}` },
                    aiMessage: "I'm having trouble formatting my response correctly. Please check the console for details or try again."
                };
            }
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", parseError);
            console.error("Raw AI response text:", rawText);
            return {
                files: { "error.txt": `Failed to parse AI response. Raw text: ${rawText}` },
                aiMessage: "Sorry, I couldn't format my response correctly. Please try rephrasing your request or check the console for technical details."
            };
        }

    } catch (error) {
        console.error("Error sending message to AI:", error);
        // Don't reset session here by default, let caller decide.
        // resetChatSession(); 
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        return {
            files: { "error.txt": `Error from AI service: ${errorMessage}` },
            aiMessage: `Error from AI: ${errorMessage}. The chat session might be affected. Try sending your message again.`
        };
    }
};
