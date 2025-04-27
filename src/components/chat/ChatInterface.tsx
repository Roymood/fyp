import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/UseAuth';
import { Message } from '../../types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { getGroqCompletion, getOllamaCompletion, isOllamaRunning, getOllamaModels, modelSupportsGroqVision } from '../../utils/api';
import { AVAILABLE_VOICES } from '../../utils/tts';

interface ChatInterfaceProps {
  chatId: string;
}

// Interface for structured message content with images
interface MessageContent {
  text: string;
  images: string[];
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ chatId }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [ollamaModel, setOllamaModel] = useState('gemma3:4b-it-q4_K_M'); // Default to a common model
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState(AVAILABLE_VOICES[0]);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const subscriptionRef = useRef<any>(null);
  const [queuedImages, setQueuedImages] = useState<string[]>([]);
  const [groqSupportsVision, setGroqSupportsVision] = useState(true); // Default to true for Groq

  // Check if Ollama is running
  useEffect(() => {
    const checkOllama = async () => {
      const running = await isOllamaRunning();
      setOllamaAvailable(running);
      
      if (running) {
        const models = await getOllamaModels();
        setAvailableModels(models);
        console.log('Available Ollama models:', models);
        
        // If we have models and the current model isn't in the list, use the first available one
        if (models.length > 0 && !models.includes(ollamaModel)) {
          setOllamaModel(models[0]);
        }
      }
    };
    
    checkOllama();
    
    // Check periodically
    const interval = setInterval(checkOllama, 30000);
    return () => clearInterval(interval);
  }, [ollamaModel]);

  // Update vision support status when model changes
  useEffect(() => {
    // Check if Groq model supports vision
    setGroqSupportsVision(modelSupportsGroqVision());
  }, []);

  // Fetch messages on component mount or when chatId changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!chatId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true });
        
        if (error) {
          throw error;
        }
        
        setMessages(data as Message[]);
      } catch (err: any) {
        console.error('Error fetching messages:', err);
        setError('Failed to load messages');
      } finally {
        setLoading(false);
      }
    };
    
    fetchMessages();
    
    // Clean up previous subscription if it exists
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }
    
    // Set up real-time subscription for new messages with improved handling
    const subscription = supabase
      .channel(`messages-channel-${chatId}`) // Unique channel per chat
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages',
          filter: `chat_id=eq.${chatId}` 
        }, 
        (payload) => {
          console.log('New message received:', payload.new);
          const newMessage = payload.new as Message;
          setMessages(prev => {
            // Check if the message is already in the array to avoid duplicates
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();
    
    subscriptionRef.current = subscription;
    
    // Get user settings
    const fetchUserSettings = async () => {
      if (!user) return;
      
      try {
        // First check if user settings exist
        const { data, error } = await supabase
          .from('user_settings')
          .select('preferred_mode, preferred_model')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 is "Results contain 0 rows"
          console.warn('Error fetching user settings:', error);
          return;
        }
        
        if (!data) {
          // If user settings don't exist, create them
          try {
            console.log('Creating user settings for user:', user.id);
            await supabase.from('user_settings').insert({
              user_id: user.id,
              preferred_mode: 'online',
              preferred_model: 'gemma3:4b-it-q4_K_M'
            });
          } catch (insertErr) {
            console.error('Error creating user settings:', insertErr);
          }
        } else {
          // Use the settings we found
          setMode(data.preferred_mode as 'online' | 'offline');
          if (data.preferred_model) {
            setOllamaModel(data.preferred_model);
          }
        }
      } catch (err) {
        console.error('Error handling user settings:', err);
      }
    };
    
    fetchUserSettings();
    
    return () => {
      // Clean up subscription
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [chatId, user]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Debugging function for API connections
  const testConnection = async (connectionType: 'groq' | 'ollama') => {
    try {
      if (connectionType === 'groq') {
        // Test Chat API
        const groqChatApiKey = import.meta.env.VITE_GROQ_CHAT_API_KEY;
        const groqTtsApiKey = import.meta.env.VITE_GROQ_TTS_API_KEY;
        
        if (!groqChatApiKey) {
          setError('Groq Chat API key is not set');
          return;
        }
        
        // Simple test request to Groq API
        const response = await fetch('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${groqChatApiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Error connecting to Groq API: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Groq API connection successful, available models:', data.data.map((m: any) => m.id));
        setError('Groq Chat API connection successful');
        
        // Test TTS API if TTS key is available
        if (groqTtsApiKey) {
          try {
            const ttsResponse = await fetch('https://api.groq.com/openai/v1/audio/speech', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqTtsApiKey}`
              },
              body: JSON.stringify({
                model: 'playai-tts',
                input: 'Connection test successful.',
                voice: selectedVoice,
                response_format: 'wav'
              })
            });
            
            if (ttsResponse.ok) {
              setError('Groq Chat API and TTS API connections successful');
            } else {
              setError('Groq Chat API connection successful, but TTS API test failed');
            }
          } catch (ttsError) {
            console.warn('TTS test failed but Chat API connection works:', ttsError);
            setError('Groq Chat API connection successful, but TTS API test failed');
          }
        }
      } else {
        // Check if Ollama is running
        const isRunning = await isOllamaRunning();
        if (!isRunning) {
          setError('Ollama is not running. Please start Ollama and try again.');
          return;
        }
        
        // Get available models
        const models = await getOllamaModels();
        if (models.length === 0) {
          setError('Connected to Ollama, but no models were found. Please install at least one model.');
          return;
        }
        
        console.log('Ollama API connection successful, available models:', models);
        setError(`Ollama API connection successful. Available models: ${models.join(', ')}`);
        
        // Update the selected model if it's not in the list
        if (!models.includes(ollamaModel) && models.length > 0) {
          setOllamaModel(models[0]);
        }
      }
    } catch (err: any) {
      console.error(`${connectionType} connection test failed:`, err);
      setError(`Failed to connect to ${connectionType}: ${err.message}`);
    }
  };

  // Function to parse message content
  const parseMessageContent = (content: string): { text: string, images: string[] } => {
    try {
      // Try to parse as JSON
      if (content.startsWith('{') && content.endsWith('}')) {
        const parsed = JSON.parse(content);
        if (parsed.text !== undefined) {
          return {
            text: parsed.text || '',
            images: Array.isArray(parsed.images) ? parsed.images : []
          };
        }
      }
    } catch (e) {
      // Not valid JSON
    }
    
    // If not JSON or parsing failed, return as plain text
    return { text: content, images: [] };
  };

  // Function to store message content in database
  const storeMessageInDB = async (
    role: 'user' | 'assistant', 
    text: string, 
    images: string[] = []
  ): Promise<{ data: any; error: any }> => {
    // Format content as JSON if it contains images
    let content: string;
    
    if (images && images.length > 0) {
      // Store as JSON with images
      content = JSON.stringify({
        text,
        images
      });
    } else {
      // Store as plain text
      content = text;
    }
    
    // Insert into database
    return await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        role,
        content,
      })
      .select();
  };

  const sendMessage = async (content: string, images?: string[]) => {
    if ((!content.trim() && (!images || images.length === 0)) || !user || !chatId) return;
    
    try {
      setSending(true);
      setError(null);
      
      // Optimistically add the user message to UI immediately
      const tempUserMessage: Partial<Message> = {
        chat_id: chatId,
        role: 'user',
        content: images && images.length > 0 ? JSON.stringify({ text: content, images }) : content,
        created_at: new Date().toISOString(),
      };
      
      // Add to local state immediately for responsiveness
      setMessages(prev => [...prev, tempUserMessage as Message]);
      
      // Add user message to the database
      const { data: userMessageData, error: userMessageError } = await storeMessageInDB('user', content, images);
      
      if (userMessageError) {
        throw userMessageError;
      }
      
      // Update the temporary message with the real one if needed
      if (userMessageData && userMessageData.length > 0) {
        const realUserMessage = userMessageData[0] as Message;
        setMessages(prev => 
          prev.map(msg => 
            msg === tempUserMessage ? realUserMessage : msg
          )
        );
      }
      
      // Get all messages for context
      const { data: allMessagesData, error: allMessagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      
      if (allMessagesError) {
        throw allMessagesError;
      }
      
      // Process messages for AI processing to extract text content
      const processedMessages = (allMessagesData as Message[]).map(msg => {
        const { text } = parseMessageContent(msg.content);
        return {
          ...msg,
          content: text
        };
      });
      
      // Add temporary AI "thinking" message
      const tempAiMessage: Partial<Message> = {
        chat_id: chatId,
        role: 'assistant',
        content: '...',
        created_at: new Date().toISOString(),
        model: mode === 'online' ? 'groq-thinking' : `ollama-thinking`,
      };
      
      // Add to local state
      setMessages(prev => [...prev, tempAiMessage as Message]);
      
      try {
        let aiResponse: string;
        let modelName: string;
        
        if (mode === 'online') {
          // Test Groq API key before sending
          const groqChatApiKey = import.meta.env.VITE_GROQ_CHAT_API_KEY;
          if (!groqChatApiKey) {
            throw new Error('Please set a valid Groq Chat API key in your .env file');
          }
          
          // Use Groq API - pass images if we have them and model supports vision
          console.log('Using Groq API in online mode');
          aiResponse = await getGroqCompletion(
            processedMessages, 
            images // Pass images directly
          );
          
          // Get the model name from env
          const groqModel = import.meta.env.VITE_GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
          modelName = `groq-${groqModel.split('/').pop() || 'llama-4-scout'}`;
        } else {
          // Check if Ollama is available
          if (!ollamaAvailable) {
            throw new Error('Ollama is not running. Please start Ollama and try again.');
          }
          
          // Use Ollama (offline mode)
          console.log('Using Ollama in offline mode with model:', ollamaModel);
          try {
            // Images are never passed to Ollama
            aiResponse = await getOllamaCompletion(
              processedMessages, 
              ollamaModel
            );
            modelName = `ollama-${ollamaModel}`;
          } catch (ollamaError: any) {
            console.error('Ollama error:', ollamaError);
            throw new Error(`Failed to get response from Ollama: ${ollamaError.message}`);
          }
        }
        
        // Remove the temporary AI message from local state
        setMessages(prev => prev.filter(msg => msg !== tempAiMessage));
        
        // Add AI response to the database - as plain text since it doesn't contain images
        const { data: aiMessageData, error: aiMessageError } = await storeMessageInDB(
          'assistant',
          aiResponse
        );
        
        if (aiMessageError) {
          throw aiMessageError;
        }
        
        // Make sure the real AI message is in the local state
        if (aiMessageData && aiMessageData.length > 0) {
          const realAiMessage = aiMessageData[0] as Message;
          setMessages(prev => [...prev.filter(msg => msg !== tempAiMessage), realAiMessage]);
        }
        
        // Update chat title after first exchange if it's still the default
        if (processedMessages.length <= 2) {
          const { data: chatData, error: chatError } = await supabase
            .from('chats')
            .select('title')
            .eq('id', chatId)
            .single();
          
          if (!chatError && chatData && chatData.title === 'New Chat') {
            // Generate a title based on the first message
            const newTitle = content.length > 30 
              ? content.substring(0, 30) + '...' 
              : content;
            
            await supabase
              .from('chats')
              .update({ title: newTitle })
              .eq('id', chatId);
          }
        }
      } catch (aiError: any) {
        console.error('Error getting AI response:', aiError);
        setError(`AI response error: ${aiError.message}`);
        
        // Remove the temporary AI message
        setMessages(prev => prev.filter(msg => msg !== tempAiMessage));
        
        // Add an error message to the chat
        const { data: errorMsgData } = await storeMessageInDB(
          'assistant',
          `Sorry, I encountered an error while processing your request: ${aiError.message}. Please try again.`,
          []
        );
          
        // Add the error message to the local state if available
        if (errorMsgData && errorMsgData.length > 0) {
          setMessages(prev => [...prev, errorMsgData[0] as Message]);
        }
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(`Error sending message: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const resetChat = async () => {
    if (!chatId || !window.confirm('Are you sure you want to reset this chat? All messages will be deleted.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Delete all messages for this chat
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);
      
      if (error) {
        throw error;
      }
      
      // Clear messages in the UI immediately
      setMessages([]);
      setError(null);
    } catch (err: any) {
      console.error('Error resetting chat:', err);
      setError('Failed to reset chat');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = async () => {
    // Check if Ollama is available before switching to offline mode
    if (mode === 'online' && !ollamaAvailable) {
      setError('Ollama is not running. Please start Ollama before switching to offline mode.');
      return;
    }
    
    const newMode = mode === 'online' ? 'offline' : 'online';
    setMode(newMode);
    
    // Update user preferences in the database
    if (user) {
      try {
        const { error } = await supabase
          .from('user_settings')
          .update({ preferred_mode: newMode })
          .eq('user_id', user.id);
        
        if (error) {
          console.error('Error updating mode preference:', error);
          throw error;
        }
      } catch (err) {
        console.error('Error updating user settings:', err);
      }
    }
  };

  const toggleTTS = () => {
    setIsTTSEnabled(!isTTSEnabled);
  };

  // Determine if image uploads should be enabled - simplified to only allow in online mode
  const shouldEnableImageUpload = () => {
    return mode === 'online' && groqSupportsVision;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex justify-between items-center p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">AI Chat</h2>
          <div className="text-sm text-gray-500">
            Mode: <span className="font-medium">
              {mode === 'online' 
                ? `Online (Groq - ${import.meta.env.VITE_GROQ_CHAT_MODEL?.split('/').pop() || 'llama-4-scout'})` 
                : `Offline (Ollama - ${ollamaModel})`}
            </span>
            {mode === 'offline' && !ollamaAvailable && (
              <span className="text-red-500 ml-2">⚠️ Ollama not running</span>
            )}
          </div>
        </div>
        <div className="flex space-x-2">
          {/* TTS Control - Only show in online mode */}
          {mode === 'online' && (
            <div className="relative">
              <button 
                onClick={toggleTTS}
                className={`btn btn-secondary text-sm ${isTTSEnabled ? 'bg-blue-100' : ''}`}
                title={isTTSEnabled ? "Text-to-Speech enabled" : "Text-to-Speech disabled"}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.189-11.09a5 5 0 011.414-1.414M12 18a6 6 0 100-12 6 6 0 000 12z" />
                </svg>
                <span className="ml-1">{isTTSEnabled ? "TTS On" : "TTS Off"}</span>
              </button>
              
              {/* Voice Selector - Only show when TTS is enabled and in online mode */}
              {isTTSEnabled && (
                <div className="relative">
                  <button 
                    onClick={() => setShowVoiceSelector(!showVoiceSelector)}
                    className="text-xs text-blue-600 hover:text-blue-800 ml-2"
                  >
                    {showVoiceSelector ? "Hide voices" : "Change voice"}
                  </button>
                  
                  {showVoiceSelector && (
                    <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded shadow-lg z-10 max-h-48 overflow-y-auto">
                      <div className="p-2 text-xs font-semibold text-gray-700 border-b">
                        Select Voice
                      </div>
                      {AVAILABLE_VOICES.map(voice => (
                        <button
                          key={voice}
                          className={`w-full text-left p-2 text-sm hover:bg-gray-100 ${selectedVoice === voice ? 'bg-blue-50 font-medium' : ''}`}
                          onClick={() => {
                            setSelectedVoice(voice);
                            setShowVoiceSelector(false);
                          }}
                        >
                          {voice}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          <button 
            onClick={() => testConnection(mode === 'online' ? 'groq' : 'ollama')}
            className="btn btn-secondary text-sm"
            title="Test connection"
          >
            Test Connection
          </button>
          <button 
            onClick={toggleMode}
            className="btn btn-secondary text-sm"
            title={`Switch to ${mode === 'online' ? 'offline' : 'online'} mode`}
            disabled={mode === 'online' && !ollamaAvailable}
          >
            {mode === 'online' ? 'Switch to Offline' : 'Switch to Online'}
          </button>
          <button 
            onClick={resetChat}
            className="btn btn-secondary text-sm"
            title="Reset this chat"
          >
            Reset Chat
          </button>
        </div>
      </div>
      
      {/* Messages area */}
      <div className="flex-grow overflow-y-auto p-4 bg-gray-50">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {mode === 'offline' && !ollamaAvailable && (
          <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
            <h3 className="font-bold">Ollama not detected</h3>
            <p>Please make sure Ollama is installed and running on your computer.</p>
            <ol className="list-decimal ml-5 mt-2">
              <li>Download and install <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="underline">Ollama</a></li>
              <li>Start the Ollama application</li>
              <li>Run <code className="bg-gray-200 px-1 rounded">ollama pull gemma:2b</code> to download a model</li>
              <li>Click "Test Connection" above to verify</li>
            </ol>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <MessageList 
            messages={messages} 
            isTTSEnabled={isTTSEnabled && mode === 'online'} 
            selectedVoice={selectedVoice}
            parseMessageContent={parseMessageContent}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input area */}
      <div className="p-4 border-t">
        <MessageInput 
          onSendMessage={sendMessage} 
          disabled={sending || (mode === 'offline' && !ollamaAvailable)} 
          placeholder={mode === 'offline' && !ollamaAvailable ? 
            "Ollama is not running. Please start Ollama to chat in offline mode." : 
            "Type your message..."
          }
          currentModel={mode === 'offline' ? ollamaModel : import.meta.env.VITE_GROQ_CHAT_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'}
          supportsImages={shouldEnableImageUpload()}
        />
      </div>
    </div>
  );
};

export default ChatInterface;