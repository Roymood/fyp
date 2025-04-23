# AI-Chatter

A powerful, dual-mode chat application with advanced AI capabilities, featuring both online (Groq) and offline (Ollama) modes, image analysis, text-to-speech, and seamless conversation history management.

## 🌟 Features

- **Dual-Mode Operation**:
  - **Online Mode**: Connect to Groq's powerful LLMs for best performance
  - **Offline Mode**: Use locally installed Ollama models for complete privacy
  
- **Advanced AI Capabilities**:
  - Multi-turn conversations with context retention
  - Image analysis with vision-capable models
  - Structured responses via model configuration
  
- **Rich Media Support**:
  - Upload and analyze images (up to 5 per message)
  - Text-to-speech with 19 different voice options
  - Rich text formatting in responses
  
- **Seamless User Experience**:
  - Realtime updates with Supabase subscriptions
  - User authentication and session management
  - Chat history with reset capability
  
- **Robust Architecture**:
  - Secure database design with RLS policies
  - API key management via environment variables
  - Responsive design for all device sizes

## 🛠️ Technology Stack

- **Frontend**:
  - React with TypeScript
  - Vite for fast development
  - Tailwind CSS for styling
  
- **Backend**:
  - Supabase for authentication & database
  - PostgreSQL for data storage
  
- **AI Integration**:
  - Groq API for cloud-based AI
  - Ollama for local AI models
  - PlayAI TTS for speech synthesis

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- Groq API account with keys
- Ollama installed locally (for offline mode)

## 🚀 Getting Started

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/ai-chatter.git
   cd ai-chatter
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GROQ_CHAT_API_KEY=your_groq_chat_api_key
   VITE_GROQ_TTS_API_KEY=your_groq_tts_api_key
   VITE_GROQ_CHAT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
   ```

4. **Set up Supabase database**:
   Run the SQL setup script in your Supabase SQL editor:
   ```sql
   -- Create tables
   CREATE TABLE chats (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     title TEXT NOT NULL DEFAULT 'New Chat',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     is_active BOOLEAN NOT NULL DEFAULT true
   );

   CREATE TABLE messages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
     content TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     model TEXT
   );

   CREATE TABLE user_settings (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     preferred_mode TEXT NOT NULL DEFAULT 'online' CHECK (preferred_mode IN ('online', 'offline')),
     preferred_model TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );

   -- Enable RLS
   ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
   ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

   -- Create policies (see full setup SQL in docs folder)
   -- ...
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

## 💬 Using AI-Chatter

### Authentication
- Sign up for a new account or log in with existing credentials
- Reset password functionality is available if needed

### Chat Interface
- **Switch between online and offline modes** using the top right controls
- **Test connections** to verify API and service availability
- **Reset chats** to clear conversation history
- **Create multiple chat sessions** using the sidebar

### Online Mode (Groq)
- Requires internet connection and valid API keys
- Supports image analysis with vision-capable models
- Provides text-to-speech capabilities

### Offline Mode (Ollama)
- Works without internet using locally installed models
- May support image analysis if model has vision capabilities
- No text-to-speech support in offline mode

### Working with Images
- Click the image icon in the message input area
- Upload an image or drag and drop (up to 5 images)
- Add text to your message if desired, then send
- Model will analyze and respond to image content

### Using Text-to-Speech
- Enable TTS with the speaker button (online mode only)
- Click "Listen" on any assistant message to hear it spoken
- Change voices using the voice selector dropdown
- Stop playback at any time with the stop button

## 🔌 API Integration

### Groq API
- Used for both chat completion and text-to-speech
- Requires separate API keys for each service
- Set up at [console.groq.com](https://console.groq.com)

### Ollama
- Local deployment of open-source models
- Download from [ollama.com](https://ollama.com)
- Install models with: `ollama pull modelname`
- Must be running for offline mode to work

## 📊 Database Structure

### Tables
- `chats`: Stores chat sessions
- `messages`: Stores individual messages with content
- `user_settings`: Stores user preferences

Regular text messages are stored as plain strings for efficiency.

## 🧩 Architecture

The application follows a modern React architecture:
- Component-based UI structure
- Context for state management
- Custom hooks for reusable logic
- Utility functions for API interactions

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Developed with ❤️ for the AI community