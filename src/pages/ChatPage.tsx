import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/UseAuth';
import { supabase } from '../config/supabase';
import { Chat } from '../types';
import ChatInterface from '../components/chat/ChatInterface';

const ChatPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user's chats
    const fetchChats = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('updated_at', { ascending: false });
        
        if (error) {
          throw error;
        }
        
        setChats(data as Chat[]);
        
        // If there are chats, set the first one as active
        if (data && data.length > 0) {
          setActiveChat(data[0].id);
        } else {
          // Create a new chat if none exists
          createNewChat();
        }
      } catch (err: any) {
        console.error('Error fetching chats:', err);
        setError('Failed to load chats');
      } finally {
        setLoading(false);
      }
    };
    
    fetchChats();

    // Set up real-time subscription for chat updates
    const subscription = supabase
      .channel('chats-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chats',
          filter: user ? `user_id=eq.${user.id}` : undefined
        }, 
        () => {
          // Refresh chats when there's any change
          fetchChats();
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const createNewChat = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('chats')
        .insert({
          user_id: user.id,
          title: 'New Chat',
        })
        .select();
      
      if (error) {
        throw error;
      }
      
      if (data && data.length > 0) {
        const newChat = data[0] as Chat;
        setChats([newChat, ...chats]);
        setActiveChat(newChat.id);
      }
    } catch (err) {
      console.error('Error creating new chat:', err);
      setError('Failed to create new chat');
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    
    if (!window.confirm('Are you sure you want to delete this chat?')) {
      return;
    }
    
    try {
      // Instead of deleting, just set is_active to false
      const { error } = await supabase
        .from('chats')
        .update({ is_active: false })
        .eq('id', chatId);
      
      if (error) {
        throw error;
      }
      
      // Update the chats list
      setChats(chats.filter(chat => chat.id !== chatId));
      
      // If the active chat was deleted, set another one as active
      if (activeChat === chatId) {
        const remainingChats = chats.filter(chat => chat.id !== chatId);
        if (remainingChats.length > 0) {
          setActiveChat(remainingChats[0].id);
        } else {
          setActiveChat(null);
          // Create a new chat if all were deleted
          createNewChat();
        }
      }
    } catch (err) {
      console.error('Error deleting chat:', err);
      setError('Failed to delete chat');
    }
  };

  const handleChatSelection = (chatId: string) => {
    setActiveChat(chatId);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold">AI-Chatter</h1>
          <button 
            onClick={signOut}
            className="text-sm text-gray-400 hover:text-white"
            title="Sign out"
          >
            Sign Out
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={createNewChat}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center justify-center"
          >
            <span className="mr-1">+</span> New Chat
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {chats.length === 0 ? (
                <div className="text-gray-500 text-center p-4">
                  No chats yet
                </div>
              ) : (
                chats.map((chat) => (
                  /* Fix: Changed button to div to avoid nesting buttons */
                  <div
                    key={chat.id}
                    onClick={() => handleChatSelection(chat.id)}
                    className={`w-full text-left p-2 rounded-md transition-colors cursor-pointer ${
                      activeChat === chat.id
                        ? 'bg-gray-700 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate">{chat.title}</span>
                      {/* This button is now safely not nested in another button */}
                      <button
                        onClick={(e) => deleteChat(chat.id, e)}
                        className="text-gray-500 hover:text-gray-300 text-sm"
                        title="Delete chat"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-grow flex flex-col">
        {error && (
          <div className="bg-red-100 text-red-700 p-3 m-4 rounded">
            {error}
          </div>
        )}
        
        {activeChat ? (
          <ChatInterface chatId={activeChat} key={activeChat} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">
              {loading ? 'Loading...' : 'Select or create a chat'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;