CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id),
  participant_2 UUID NOT NULL REFERENCES users(id),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2),
  CHECK (participant_1 < participant_2)
);

CREATE INDEX idx_chat_conversations_p1 ON chat_conversations(participant_1);
CREATE INDEX idx_chat_conversations_p2 ON chat_conversations(participant_2);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Conversation policies: participants only
CREATE POLICY "Users can view own conversations" ON chat_conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations" ON chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Message policies: conversation participants only
CREATE POLICY "Users can view messages in own conversations" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in own conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can update own messages" ON chat_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE id = chat_messages.conversation_id
      AND (participant_1 = auth.uid() OR participant_2 = auth.uid())
    )
  );

-- Enable realtime for chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
