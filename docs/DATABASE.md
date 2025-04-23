# AI-Chatter Database Setup

This document provides complete instructions for setting up the database schema for the AI-Chatter application in Supabase.

## Introduction

AI-Chatter uses a Supabase PostgreSQL database with the following structure:
- `chats` table for storing chat sessions
- `messages` table for storing individual messages
- `user_settings` table for storing user preferences

The schema includes Row Level Security (RLS) policies to ensure data privacy and security.

## Setup Steps

1. Log in to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to the SQL Editor
4. Create a new query
5. Copy and paste the SQL code below
6. Run the query

## Complete SQL Schema

```sql
-- AI-Chatter Complete Database Schema
-- This SQL script sets up all tables, functions, triggers, and security policies
-- Run this in your Supabase SQL Editor

-- =============================================
-- Create Tables
-- =============================================

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
  content TEXT NOT NULL, -- Can contain plain text or JSON-structured content with images
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT -- which AI model was used (can be null for user messages)
);

-- Create user_settings table for preferences
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_mode TEXT NOT NULL DEFAULT 'online' CHECK (preferred_mode IN ('online', 'offline')),
  preferred_model TEXT DEFAULT 'gemma3:4b-it-q4_K_M',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- Create Indexes for Performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- =============================================
-- Create Function to Update Timestamps
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Create Triggers for Timestamps
-- =============================================
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

-- =============================================
-- Create Function to Handle Message Content
-- =============================================
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

-- Create the trigger for message content
DROP TRIGGER IF EXISTS format_message_content_trigger ON messages;
CREATE TRIGGER format_message_content_trigger
BEFORE INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION format_message_content();

-- =============================================
-- Create Function to Reset a Chat
-- =============================================
CREATE OR REPLACE FUNCTION reset_chat(chat_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM messages WHERE chat_id = reset_chat.chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- Create Function to Handle New Users
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create initial user settings
  INSERT INTO user_settings (
    user_id, 
    preferred_mode, 
    preferred_model
  )
  VALUES (
    NEW.id, 
    'online', 
    'gemma3:4b-it-q4_K_M'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE PROCEDURE handle_new_user();

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Create RLS Policies for Chats Table
-- =============================================

-- Select policy - Users can only see their own chats
DROP POLICY IF EXISTS chats_select_policy ON chats;
CREATE POLICY chats_select_policy ON chats
  FOR SELECT USING (auth.uid() = user_id);

-- Insert policy - Users can only create chats for themselves
DROP POLICY IF EXISTS chats_insert_policy ON chats;
CREATE POLICY chats_insert_policy ON chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy - Users can only update their own chats
DROP POLICY IF EXISTS chats_update_policy ON chats;
CREATE POLICY chats_update_policy ON chats
  FOR UPDATE USING (auth.uid() = user_id);

-- Delete policy - Users can only delete their own chats
DROP POLICY IF EXISTS chats_delete_policy ON chats;
CREATE POLICY chats_delete_policy ON chats
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- Create RLS Policies for Messages Table
-- =============================================

-- Select policy - Users can only see messages in their own chats
DROP POLICY IF EXISTS messages_select_policy ON messages;
CREATE POLICY messages_select_policy ON messages
  FOR SELECT USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Insert policy - Users can only add messages to their own chats
DROP POLICY IF EXISTS messages_insert_policy ON messages;
CREATE POLICY messages_insert_policy ON messages
  FOR INSERT WITH CHECK (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Update policy - Users can only update messages in their own chats
DROP POLICY IF EXISTS messages_update_policy ON messages;
CREATE POLICY messages_update_policy ON messages
  FOR UPDATE USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- Delete policy - Users can only delete messages in their own chats
DROP POLICY IF EXISTS messages_delete_policy ON messages;
CREATE POLICY messages_delete_policy ON messages
  FOR DELETE USING (
    chat_id IN (SELECT id FROM chats WHERE user_id = auth.uid())
  );

-- =============================================
-- Create RLS Policies for User Settings Table
-- =============================================

-- Select policy - Users can only see their own settings
DROP POLICY IF EXISTS user_settings_select_policy ON user_settings;
CREATE POLICY user_settings_select_policy ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

-- Insert policy - Users can only create settings for themselves
DROP POLICY IF EXISTS user_settings_insert_policy ON user_settings;
CREATE POLICY user_settings_insert_policy ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update policy - Users can only update their own settings
DROP POLICY IF EXISTS user_settings_update_policy ON user_settings;
CREATE POLICY user_settings_update_policy ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- Grant Permissions for Service Role
-- =============================================

-- Grant service role full access to tables
GRANT ALL ON TABLE chats TO service_role;
GRANT ALL ON TABLE messages TO service_role;
GRANT ALL ON TABLE user_settings TO service_role;

-- Grant service role access to functions
GRANT EXECUTE ON FUNCTION update_updated_at() TO service_role;
GRANT EXECUTE ON FUNCTION format_message_content() TO service_role;
GRANT EXECUTE ON FUNCTION reset_chat(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- =============================================
-- Grant Permissions for Authenticated Users
-- =============================================

-- Grant authenticated users access to tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE chats TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE user_settings TO authenticated;

-- Grant authenticated users access to relevant functions
GRANT EXECUTE ON FUNCTION reset_chat(UUID) TO authenticated;

-- =============================================
-- Grant Permissions for Anonymous Users
-- =============================================

-- Grant anonymous users access for authentication flow
GRANT SELECT, INSERT ON TABLE user_settings TO anon;
```

## Schema Explanation

### Tables

1. **Chats Table**
   - Stores individual chat sessions per user
   - `is_active` flag allows for "soft delete" functionality
   - Each chat belongs to a specific user

2. **Messages Table**
   - Stores all messages in all chats
   - Links to parent chat via `chat_id`
   - Stores message role (user/assistant), content, and model info
   - Content field can store either plain text or JSON with images

3. **User Settings Table**
   - Stores user preferences
   - Includes preferred mode (online/offline) and model

### Security

The database uses Row Level Security (RLS) to ensure:
- Users can only access their own data
- No user can see or modify another user's chats or messages
- Service roles have appropriate access for system functions

### Functions and Triggers

1. **Timestamp Management**
   - Automatically updates the `updated_at` field when records change

2. **User Onboarding**
   - Creates default settings for new users automatically

3. **Chat Reset**
   - Provides functionality to clear a chat's message history

4. **Message Content Handling**
   - Supports storing both plain text and JSON-formatted content with images

## Next Steps

After running this SQL script:

1. Verify that the tables were created correctly
2. Check that RLS policies are active
3. Test creating a user and confirm that the triggers create the appropriate settings

For more information, refer to the [Supabase documentation](https://supabase.com/docs) and the [AI-Chatter README](../README.md).