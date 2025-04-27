// src/utils/imageHandling.ts

/**
 * Converts an image file to a base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Return the complete data URL
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = error => reject(error);
  });
};

/**
 * Validates if a file is an acceptable image
 */
export const isValidImageFile = (file: File): boolean => {
  // Check if file is an image
  if (!file.type.startsWith('image/')) {
    return false;
  }
  
  // Check file size (limit to 4MB as per Groq's documentation)
  const MAX_SIZE = 4 * 1024 * 1024; // 4MB
  if (file.size > MAX_SIZE) {
    return false;
  }
  
  return true;
};

/**
 * Creates a message with image content for API in the exact format required by Groq
 * This follows the format from Groq's documentation for vision models
 */
export const createImageMessage = (text: string, images: string[]): any => {
  // Create the content array exactly as specified in Groq docs
  const content = [
    { type: "text", text: text || "What's in this image?" },
    ...images.map(image => ({
      type: "image_url",
      image_url: {
        url: image // Use the full data URL
      }
    }))
  ];
  
  return {
    role: 'user',
    content: content
  };
};

/**
 * Compresses an image to reduce its size while maintaining quality
 * Ensures we stay under Groq's 4MB limit for base64 encoded images
 */
export const compressImage = (file: File, maxWidth = 1024): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      // Check if image exceeds Groq's resolution limit of 33 megapixels
      const totalPixels = width * height;
      const MAX_PIXELS = 33177600; // 33 megapixels
      
      if (totalPixels > MAX_PIXELS) {
        const scaleFactor = Math.sqrt(MAX_PIXELS / totalPixels);
        width = Math.floor(width * scaleFactor);
        height = Math.floor(height * scaleFactor);
      }
      
      // Scale down if width is larger than maxWidth
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert canvas to blob with reduced quality for larger images
      const quality = totalPixels > 1000000 ? 0.7 : 0.9; // Use lower quality for large images
      
      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }
          
          // Create a new file from the blob
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          
          resolve(compressedFile);
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
  });
};

/**
 * Checks if a model has vision capabilities - simplified to only check Groq models
 */
export const modelSupportsVision = (modelName: string): boolean => {
  // Only check for Groq vision models
  return modelName.includes('llama-4-scout') || modelName.includes('llama-4-maverick');
};