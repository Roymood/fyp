import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './imageuploader';

interface MessageInputProps {
  onSendMessage: (message: string, images?: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  currentModel?: string;
  supportsImages?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  disabled = false,
  placeholder = "Type your message...",
  currentModel = "",
  supportsImages = false
}) => {
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set the height to scrollHeight to fit the content
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max height of 200px
    textarea.style.height = `${newHeight}px`;
  }, [message]);

  const handleSend = () => {
    if ((message.trim() || images.length > 0) && !disabled) {
      onSendMessage(message, images.length > 0 ? images : undefined);
      setMessage('');
      setImages([]);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageUpload = (dataUrl: string) => {
    // Store the full data URL
    setImages([...images, dataUrl]);
    console.log('Image added to queue', images.length + 1);
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  return (
    <div className="space-y-2">
      {/* Image previews */}
      {images.length > 0 && (
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {images.map((dataUrl, index) => (
            <div key={index} className="relative flex-shrink-0">
              <img 
                src={dataUrl} 
                alt={`Upload ${index + 1}`} 
                className="h-16 w-16 object-cover rounded border border-gray-300" 
              />
              <button 
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                onClick={() => removeImage(index)}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Input area */}
      <div className="flex items-end space-x-2">
        <div className="flex-grow relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="input resize-none min-h-[40px] max-h-[200px] py-2 pr-10"
            rows={1}
            disabled={disabled}
          ></textarea>
          
          {/* Image upload button - only show if model supports vision */}
          {supportsImages && (
            <div className="absolute right-2 bottom-2">
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                disabled={disabled || images.length >= 5} // Limit to 5 images
              />
            </div>
          )}
        </div>
        
        <button
          onClick={handleSend}
          className={`btn ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'btn-primary'} h-10 px-4`}
          disabled={(!message.trim() && images.length === 0) || disabled}
        >
          {disabled ? (
            <div className="h-5 w-5 animate-spin rounded-full border-t-2 border-b-2 border-white"></div>
          ) : (
            'Send'
          )}
        </button>
      </div>
      
      {/* Show image upload info if model supports vision */}
      {supportsImages && images.length === 0 && (
        <div className="text-xs text-gray-500">
          This model supports images. Click the icon or drag and drop to upload images (max 5).
        </div>
      )}
    </div>
  );
};

export default MessageInput;