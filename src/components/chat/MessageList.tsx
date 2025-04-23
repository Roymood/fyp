import React, { useState, useRef } from 'react';
import { Message } from '../../types';
import { speakText } from '../../utils/tts';

interface MessageListProps {
  messages: Message[];
  isTTSEnabled: boolean;
  selectedVoice: string;
  parseMessageContent: (content: string) => { text: string, images: string[] };
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isTTSEnabled,
  selectedVoice,
  parseMessageContent
}) => {
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});
  const [ttsError, setTtsError] = useState<string | null>(null);
  
  if (messages.length === 0) {
    return (
      <div className="text-center text-gray-500 py-10">
        No messages yet. Start by typing a message below.
      </div>
    );
  }
  
  const handlePlayTTS = async (messageId: string, content: string) => {
    try {
      setTtsError(null);
      
      // Cancel any currently playing audio
      if (playingAudio && audioRefs.current[playingAudio]) {
        audioRefs.current[playingAudio]?.pause();
      }
      
      setPlayingAudio(messageId);
      
      const audio = await speakText(content, selectedVoice);
      
      if (audio) {
        audioRefs.current[messageId] = audio;
        
        // When audio completes
        audio.onended = () => {
          setPlayingAudio(null);
          audioRefs.current[messageId] = null;
        };
      }
    } catch (error: any) {
      console.error('TTS error:', error);
      setTtsError(error.message || 'Failed to play speech');
      setPlayingAudio(null);
    }
  };
  
  const stopTTS = (messageId: string) => {
    if (audioRefs.current[messageId]) {
      audioRefs.current[messageId]?.pause();
      audioRefs.current[messageId] = null;
      setPlayingAudio(null);
    }
  };

  return (
    <div className="space-y-4">
      {ttsError && (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
          <strong>Text-to-Speech Error:</strong> {ttsError}
          {ttsError.includes('requires terms acceptance') && (
            <div className="mt-2">
              <p>To use Groq TTS, you need to accept the terms first:</p>
              <ol className="list-decimal ml-5 mt-1">
                <li>Visit <a href="https://console.groq.com/playground?model=playai-tts" target="_blank" rel="noreferrer" className="underline">Groq console</a></li>
                <li>Sign in with your Groq account</li>
                <li>Accept the terms for the playai-tts model</li>
              </ol>
            </div>
          )}
        </div>
      )}
      
      {messages.map((message, index) => {
        // Check if this is a temporary "thinking" message
        const isThinking = message.model?.includes('thinking');
        
        // Parse the message content to extract text and images
        const { text, images } = parseMessageContent(message.content);
        
        // Generate a key for the message
        const messageKey = message.id || `temp-${index}`;
        
        return (
          <div 
            key={messageKey} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : isThinking 
                    ? 'bg-white border border-gray-200 rounded-bl-none bg-opacity-70' 
                    : 'bg-white border border-gray-200 rounded-bl-none'
              }`}
            >
              {isThinking ? (
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                </div>
              ) : (
                <>
                  {/* Display text content */}
                  <div className="text-sm break-words whitespace-pre-wrap">{text}</div>
                  
                  {/* Display any images */}
                  {images.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {images.map((imageUrl, imgIndex) => (
                        <img 
                          key={`${messageKey}-img-${imgIndex}`}
                          src={imageUrl} 
                          alt={`Image ${imgIndex + 1}`}
                          className="max-w-full rounded"
                          style={{ maxHeight: '300px' }}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* TTS button for assistant messages */}
                  {message.role === 'assistant' && isTTSEnabled && !isThinking && text.length > 0 && (
                    <div className="mt-2 flex justify-end">
                      {playingAudio === messageKey ? (
                        <button
                          onClick={() => stopTTS(messageKey)}
                          className="text-xs flex items-center text-gray-500 hover:text-gray-700"
                          title="Stop speech"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <rect x="6" y="6" width="12" height="12" rx="1" />
                          </svg>
                          Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePlayTTS(messageKey, text)}
                          className="text-xs flex items-center text-gray-500 hover:text-gray-700"
                          title="Play speech"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.189-11.09a5 5 0 011.414-1.414M12 18a6 6 0 100-12 6 6 0 000 12z" />
                          </svg>
                          Listen
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
              
              {message.model && message.role === 'assistant' && !isThinking && (
                <div className="text-xs mt-1 text-gray-400">
                  {message.model}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;