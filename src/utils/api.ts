import { Message } from '../types';
import { createImageMessage, modelSupportsVision } from './imagehandling';

// Enhanced Groq API integration with vision support - Fixed for proper image format
const getGroqCompletion = async (
  messages: Message[],
  imageData?: string[]
): Promise<string> => {
  // Use the chat-specific API key
  const groqChatApiKey = import.meta.env.VITE_GROQ_CHAT_API_KEY;
  
  if (!groqChatApiKey) {
    throw new Error('Groq Chat API key is missing');
  }

  // Get the model from env or use default
  const model = import.meta.env.VITE_GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  
  try {
    console.log(`Calling Groq API with model: ${model}`);
    
    // Format messages for the Groq API based on whether we have images
    let apiMessages;
    
    if (imageData && imageData.length > 0) {
      // Use the exact format required by the Groq API documentation
      const recentMessages = messages.slice(-10); // Only use the last 10 messages
      const lastMessage = recentMessages[recentMessages.length - 1];
      const otherMessages = recentMessages.slice(0, -1).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Create the properly formatted multimodal message with correct content structure
      const formattedContent = [
        { type: "text", text: lastMessage.content || "What's in this image?" },
        ...imageData.map(imgUrl => ({
          type: "image_url",
          image_url: {
            url: imgUrl // Use the full data URL as provided
          }
        }))
      ];
      
      // Add the last message with the proper format for images
      apiMessages = [
        ...otherMessages,
        {
          role: lastMessage.role,
          content: formattedContent
        }
      ];
      
      console.log('Using vision format for Groq with correct image formatting');
    } else {
      // Regular text-only format
      apiMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
    }
    
    // Log the request structure (for debugging)
    console.log('Sending request to Groq API with message format:', JSON.stringify({
      model,
      messages: apiMessages.map(m => ({
        role: m.role,
        contentType: Array.isArray(m.content) ? 'array' : 'string',
        contentLength: Array.isArray(m.content) ? m.content.length : m.content.length
      })),
      imageCount: imageData?.length || 0
    }, null, 2));
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqChatApiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Groq API error response:', errorData);
      throw new Error(errorData.error?.message || `Error calling Groq API: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Groq API:', error);
    throw error;
  }
};

// Ollama API integration
const getOllamaCompletion = async (
  messages: Message[], 
  model: string = 'gemma3:4b-it-q4_K_M',
  imageData?: string[]
): Promise<string> => {
  try {
    console.log(`Calling Ollama API with model: ${model}`);
    
    // First check if Ollama is running by checking the API
    let availableModels: string[] = [];
    try {
      const checkResponse = await fetch('http://localhost:11434/api/tags', {
        method: 'GET'
      });
      
      if (!checkResponse.ok) {
        throw new Error(`Ollama server not available: ${checkResponse.status}`);
      }
      
      const tagsData = await checkResponse.json();
      console.log('Ollama models response:', tagsData);
      
      if (tagsData && tagsData.models) {
        availableModels = tagsData.models.map((m: any) => m.name);
        console.log('Available Ollama models:', availableModels);
      } else {
        throw new Error('No models found in Ollama');
      }
      
      // Check if the requested model exists or find the closest match
      if (!availableModels.includes(model)) {
        console.warn(`Model "${model}" not found in Ollama. Will use the first available model.`);
        if (availableModels.length > 0) {
          model = availableModels[0];
          console.log(`Using model: ${model} instead`);
        } else {
          throw new Error('No models available in Ollama');
        }
      }
    } catch (e) {
      console.error('Error checking Ollama availability:', e);
      throw new Error(`Ollama server not available or not running at http://localhost:11434. Please make sure Ollama is installed and running.`);
    }
    
    // Check if we're dealing with a model that supports vision
    const hasVisionSupport = modelSupportsVision(model);
    console.log(`Model ${model} supports vision: ${hasVisionSupport}`);
    
    // Clean up the messages format for Ollama
    const recentMessages = messages.slice(-10); // Only use the last 10 messages
    
    // If the model supports vision and we have image data, use a different format
    let requestBody: any = {};
    
    if (hasVisionSupport && imageData && imageData.length > 0) {
      // The last message will be converted to include images
      const lastMessage = recentMessages[recentMessages.length - 1];
      const otherMessages = recentMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
      
      // Create a special message with images
      const imageMessage = createImageMessage(lastMessage.content, imageData);
      
      requestBody = {
        model: model,
        messages: [...otherMessages, imageMessage],
        stream: false
      };
      
      console.log('Using vision format for Ollama request');
    } else {
      // Standard text-only format
      const cleanedMessages = recentMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
      
      requestBody = {
        model: model,
        messages: cleanedMessages,
        stream: false
      };
    }
    
    // Log the actual request for debugging
    console.log('Sending request to Ollama:', {
      endpoint: 'http://localhost:11434/api/chat',
      model: model,
      messageCount: requestBody.messages.length,
      hasImages: hasVisionSupport && imageData && imageData.length > 0
    });
    
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      let errorMessage = `Ollama error: ${response.status}`;
      try {
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse JSON, use the raw text
          errorMessage = errorText || errorMessage;
        }
      } catch (e) {
        // If we can't get text either, just use the status code
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log('Ollama response received:', data);
    
    if (!data.message || typeof data.message.content !== 'string') {
      console.error('Invalid Ollama response format:', data);
      throw new Error('Invalid response format from Ollama');
    }
    
    return data.message.content;
  } catch (error) {
    console.error('Error calling Ollama API:', error);
    throw error;
  }
};

// Helper function to check if Ollama is running
const isOllamaRunning = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET'
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

// Helper to get available Ollama models
const getOllamaModels = async (): Promise<string[]> => {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET'
    });
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (e) {
    return [];
  }
};

// Helper function to check if a model supports vision capabilities
export const modelSupportsGroqVision = (): boolean => {
  // The model from environment or the default one
  const model = import.meta.env.VITE_GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
  
  // Models that support vision in Groq
  const visionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'llama-4-scout',
    'llama-4-maverick'
  ];
  
  return visionModels.some(m => model.includes(m));
};

export { getGroqCompletion, getOllamaCompletion, isOllamaRunning, getOllamaModels };