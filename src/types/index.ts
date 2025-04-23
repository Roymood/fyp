export interface User {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  }
  
  export interface Chat {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
  }
  
  export interface Message {
    id: string;
    chat_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    model?: string;
  }
  
  export interface UserSettings {
    user_id: string;
    preferred_mode: 'online' | 'offline';
    preferred_model: string;
    created_at: string;
    updated_at: string;
  }