import React, { useState, useRef } from 'react';
import { fileToBase64, isValidImageFile, compressImage } from '../../utils/imagehandling';

interface ImageUploaderProps {
  onImageUpload: (base64: string) => void;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, disabled = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      
      if (!isValidImageFile(file)) {
        setError('Please upload a valid image file (max 5MB)');
        return;
      }
      
      // Compress image if it's large
      const compressedFile = await compressImage(file);
      
      // Convert to base64 data URL (keep the full data URL)
      const dataUrl = await fileToBase64(compressedFile);
      
      // Call the callback with the data URL
      onImageUpload(dataUrl);
      console.log('Image successfully processed and uploaded');
    } catch (err) {
      console.error('Error processing image:', err);
      setError('Failed to process image');
    } finally {
      setUploading(false);
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (disabled) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
      
      // Reset the file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      <div
        className={`flex items-center justify-center border border-gray-300 rounded p-1 cursor-pointer ${
          dragActive ? 'border-blue-500 bg-blue-50' : ''
        } ${disabled || uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={disabled || uploading ? undefined : handleButtonClick}
        title={disabled ? 'Image upload disabled' : 'Upload an image'}
      >
        {uploading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
        ) : (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5 text-gray-500" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        )}
      </div>
      
      {error && (
        <div className="absolute top-full left-0 right-0 mt-1 text-xs text-red-500">
          {error}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;