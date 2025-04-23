-- AI-Chatter Complete Database Schema Setup
-- Run this in the Supabase SQL Editor to set up the complete database

-- Create chats table to store chat sessions
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create messages table to store individual messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT -- which AI model was used (can be null for user messages)
);

-- Create user_settings table for preferences
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_mode TEXT NOT NULL DEFAULT 'online' CHECK (preferred_mode IN ('online', 'offline')),
  preferred_model TEXT DEFAULT 'llama-3-70b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Create function to update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the 'updated_at' field
DROP TRIGGER IF EXISTS chats_updated_at ON chats;
CREATE TRIGGER chats_updated_at
BEFORE UPDATE ON chats
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at();

-- Function to reset a chat (delete all messages)
CREATE OR REPLACE FUNCTION reset_chat(chat_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM messages WHERE chat_id = reset_chat.chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to format message content for JSON with images
CREATE OR REPLACE FUNCTION format_message_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if content is trying to be stored as JSON
  IF NEW.content IS NOT NULL AND (
     NEW.content LIKE '{%}' OR 
     NEW.content LIKE '[%]' OR 
     NEW.content ~ '^\s*\{.*\}\s*$'
  ) THEN
    -- If it's already valid JSON, leave it alone
    RETURN NEW;
  END IF;
  
  -- Store regular text messages normally
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for message content formatting
DROP TRIGGER IF EXISTS format_message_content_trigger ON messages;
CREATE TRIGGER format_message_content_trigger
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION format_message_content();

-- Enable Row Level Security
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for chats table
DROP POLICY IF EXISTS chats_select_policy ON chats;
CREATE POLICY chats_select_policy ON chats
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_insert_policy ON chats;
CREATE POLICY chats_insert_policy ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_update_policy ON chats;
CREATE POLICY chats_update_policy ON chats
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS chats_delete_policy ON chats;
CREATE POLICY chats_delete_policy ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for messages table
DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy ON messages
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT WITH CHECK (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS messages_update_policy ON messages;
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS messages_delete_policy ON messages;
CREATE POLICY messages_delete_policy ON messages
  FOR DELETE USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Create policies for user_settings table
DROP POLICY IF EXISTS user_settings_select_policy ON user_settings;
CREATE POLICY user_settings_select_policy ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_insert_policy ON user_settings;
CREATE POLICY user_settings_insert_policy ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_settings_update_policy ON user_settings;
CREATE POLICY user_settings_update_policy ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role policy for handling user creation, etc.
DROP POLICY IF EXISTS service_role_policy ON user_settings;
CREATE POLICY service_role_policy ON user_settings
  FOR ALL TO service_role USING (true);

-- Create function to initialize user settings on signup
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id, preferred_mode, preferred_model)
  VALUES (NEW.id, 'online', 'llama-3-70b')
  ON CONFLICT (user_id) 
  DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to call the function on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT EXECUTE ON FUNCTION reset_chat TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user TO service_role;