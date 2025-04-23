// src/utils/tts.ts

// Default voice for English
const DEFAULT_VOICE = 'Arista-PlayAI';

// Array of available English voices
export const AVAILABLE_VOICES = [
  'Arista-PlayAI', 'Atlas-PlayAI', 'Basil-PlayAI', 'Briggs-PlayAI', 
  'Calum-PlayAI', 'Celeste-PlayAI', 'Cheyenne-PlayAI', 'Chip-PlayAI', 
  'Cillian-PlayAI', 'Deedee-PlayAI', 'Fritz-PlayAI', 'Gail-PlayAI', 
  'Indigo-PlayAI', 'Mamaw-PlayAI', 'Mason-PlayAI', 'Mikail-PlayAI', 
  'Mitch-PlayAI', 'Quinn-PlayAI', 'Thunder-PlayAI'
];

// Text to speech conversion using Groq API
export const textToSpeech = async (
  text: string, 
  voice: string = DEFAULT_VOICE
): Promise<string> => {
  // Use the specific TTS API key
  const groqTtsApiKey = import.meta.env.VITE_GROQ_TTS_API_KEY;
  
  if (!groqTtsApiKey) {
    throw new Error('Groq TTS API key is missing');
  }
  
  try {
    console.log(`Converting text to speech using voice: ${voice}`);
    
    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqTtsApiKey}`
      },
      body: JSON.stringify({
        model: 'playai-tts',
        input: text,
        voice: voice,
        response_format: 'wav'
      })
    });
    
    if (!response.ok) {
      let errorMessage = `Error calling Groq TTS API: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorMessage;
      } catch (e) {
        // If response is not JSON, use status code
      }
      throw new Error(errorMessage);
    }
    
    // Get response as blob
    const audioBlob = await response.blob();
    
    // Create an object URL for the audio
    const audioUrl = URL.createObjectURL(audioBlob);
    
    return audioUrl;
  } catch (error) {
    console.error('Error calling Groq TTS API:', error);
    throw error;
  }
};

// Play audio from a URL
export const playAudio = (audioUrl: string): HTMLAudioElement => {
  const audio = new Audio(audioUrl);
  audio.play().catch(error => {
    console.error('Error playing audio:', error);
  });
  return audio;
};

// Helper to check if text is suitable for TTS (not too long)
export const isSuitableForTTS = (text: string): boolean => {
  return text.length > 0 && text.length <= 5000; // Limit to 5000 chars to be safe
};

// Convert text to speech and play it
export const speakText = async (
  text: string, 
  voice: string = DEFAULT_VOICE
): Promise<HTMLAudioElement | null> => {
  try {
    if (!isSuitableForTTS(text)) {
      console.warn('Text is not suitable for TTS (empty or too long)');
      return null;
    }
    
    const audioUrl = await textToSpeech(text, voice);
    return playAudio(audioUrl);
  } catch (error) {
    console.error('Error speaking text:', error);
    throw error;
  }
};