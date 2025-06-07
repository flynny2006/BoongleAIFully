import { GoogleGenAI, Chat, GenerateContentResponse, HarmCategory, HarmBlockThreshold, Content } from "@google/genai";
import { AI_SYSTEM_PROMPT } from '../constants';
import { ChatMessage, AIProjectStructure, ModelId } from "../types";

// No global 'ai' or 'activeChatSession' or 'currentModelId' singletons anymore.
// These will be managed per-call or per-instance needed.

const convertMessagesToGenAiHistory = (messages: ChatMessage[]): Content[] => {
    return messages.map(msg => {
        if (msg.sender === 'system') return null; // System messages are for UI, not direct GenAI history. AI_SYSTEM_PROMPT handles system instructions.
        return {
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }],
        };
    }).filter(Boolean) as Content[];
};

export const getOrCreateChatSession = (
    apiKey: string, // User's API key (or fallback)
    chatHistory: ChatMessage[], 
    modelId: ModelId
): Chat => {
    if (!apiKey) {
        console.error("Gemini API Key is not provided for chat session creation.");
        alert("Gemini API Key is missing. Please configure it in your profile or ensure system key is set.");
        throw new Error("Gemini API Key is missing.");
    }

    // Create a new GoogleGenAI client instance with the provided API key for this session
    const client = new GoogleGenAI({ apiKey });
    
    console.log(`Creating new chat session for model: ${modelId} using provided API key.`);
    const genAiHistory = convertMessagesToGenAiHistory(chatHistory);

    const newChatSession = client.chats.create({
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
    return newChatSession;
};

// This function is less about resetting a global singleton now,
// and more a signal that the calling component (ProjectPage) should nullify its chatSession state.
export const resetChatSession = () => {
    console.log("Signal to reset active chat session state in consuming component.");
    // The actual state (activeChatSession) is now managed in ProjectPage.tsx
};

export const sendMessageToAI = async (
    chat: Chat, // The Chat object, already initialized with an API key
    message: string,
    modelIdUsed?: ModelId // Optional, for logging or if needed by AI
): Promise<AIProjectStructure> => {
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
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        // Check for specific API key related errors (this might need refinement based on actual Gemini SDK error types)
        if (errorMessage.toLowerCase().includes("api key not valid") || errorMessage.toLowerCase().includes("permission denied")) {
             return {
                files: { "error.txt": `Gemini API Error: ${errorMessage}. Please check if your API key is correct and has permissions.` },
                aiMessage: `There was an issue with the Gemini API call: ${errorMessage}. Please verify your API key.`
            };
        }
        return {
            files: { "error.txt": `Error from AI service: ${errorMessage}` },
            aiMessage: `Error from AI: ${errorMessage}. The chat session might be affected. Try sending your message again.`
        };
    }
};