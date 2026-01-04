const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Create connection pool
// For deployment, DATABASE_URL will be provided by the host (Render/Heroku/etc)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  family: 4 // Force IPv4 to fix ENETUNREACH on Render
});

// Initialize database tables
const initDb = async () => {
  try {
    const client = await pool.connect();
    try {
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          display_name TEXT DEFAULT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          avatar TEXT DEFAULT NULL,
          bio TEXT DEFAULT NULL,
          status TEXT DEFAULT 'offline',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Conversations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          type TEXT DEFAULT 'private',
          name TEXT DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Conversation participants
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          user_id TEXT NOT NULL REFERENCES users(id),
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, user_id)
        );
      `);

      // Messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          sender_id TEXT NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Channels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS channels (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE,
          description TEXT DEFAULT NULL,
          avatar TEXT DEFAULT NULL,
          owner_id TEXT NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Add username column if not exists (for existing databases)
      await client.query(`
        ALTER TABLE channels ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
      `).catch(() => { });

      // Groups table
      await client.query(`
        CREATE TABLE IF NOT EXISTS groups_table (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT NULL,
          avatar TEXT DEFAULT NULL,
          owner_id TEXT NOT NULL REFERENCES users(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Channel members
      await client.query(`
        CREATE TABLE IF NOT EXISTS channel_members (
          channel_id TEXT NOT NULL REFERENCES channels(id),
          user_id TEXT NOT NULL REFERENCES users(id),
          role TEXT DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (channel_id, user_id)
        );
      `);

      // Group members
      await client.query(`
        CREATE TABLE IF NOT EXISTS group_members (
          group_id TEXT NOT NULL REFERENCES groups_table(id),
          user_id TEXT NOT NULL REFERENCES users(id),
          role TEXT DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (group_id, user_id)
        );
      `);

      // Channel messages
      await client.query(`
        CREATE TABLE IF NOT EXISTS channel_messages (
          id TEXT PRIMARY KEY,
          channel_id TEXT NOT NULL REFERENCES channels(id),
          sender_id TEXT NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Group messages
      await client.query(`
        CREATE TABLE IF NOT EXISTS group_messages (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL REFERENCES groups_table(id),
          sender_id TEXT NOT NULL REFERENCES users(id),
          content TEXT NOT NULL,
          type TEXT DEFAULT 'text',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      console.log('Database tables initialized');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

// Initialize on start
initDb();

// Database helper functions
const dbHelpers = {
  // User operations
  createUser: async (username, email, password) => {
    const id = uuidv4();
    const hashedPassword = bcrypt.hashSync(password, 10);
    await pool.query(
      'INSERT INTO users (id, username, email, password) VALUES ($1, $2, $3, $4)',
      [id, username, email, hashedPassword]
    );
    return { id, username, email };
  },

  getUserByEmail: async (email) => {
    const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
  },

  getUserById: async (id) => {
    const res = await pool.query('SELECT id, username, email, avatar, status FROM users WHERE id = $1', [id]);
    return res.rows[0];
  },

  getUserByUsername: async (username) => {
    const res = await pool.query('SELECT id, username, email, avatar, status FROM users WHERE username LIKE $1', [`%${username}%`]);
    return res.rows[0];
  },

  searchUsers: async (query, currentUserId) => {
    const res = await pool.query(
      'SELECT id, username, email, avatar, status FROM users WHERE (username LIKE $1 OR email LIKE $2) AND id != $3',
      [`%${query}%`, `%${query}%`, currentUserId]
    );
    return res.rows;
  },

  updateUserStatus: async (userId, status) => {
    await pool.query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);
  },

  // Conversation operations
  createConversation: async (userId1, userId2) => {
    // Check if conversation exists
    const existing = await pool.query(`
      SELECT c.id FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
      WHERE c.type = 'private'
    `, [userId1, userId2]);

    if (existing.rows[0]) {
      return existing.rows[0].id;
    }

    const id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO conversations (id, type) VALUES ($1, \'private\')', [id]);
      await client.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)', [id, userId1]);
      await client.query('INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)', [id, userId2]);
      await client.query('COMMIT');
      return id;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  getConversations: async (userId) => {
    const res = await pool.query(`
      SELECT 
        c.id,
        c.type,
        c.created_at,
        u.id as other_user_id,
        u.username as other_username,
        u.avatar as other_avatar,
        u.status as other_status,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id != $1
      JOIN users u ON cp2.user_id = u.id
      WHERE cp.user_id = $2
      ORDER BY last_message_time DESC NULLS LAST
    `, [userId, userId]);
    return res.rows;
  },

  // Message operations
  createMessage: async (conversationId, senderId, content, type = 'text') => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await pool.query(
      'INSERT INTO messages (id, conversation_id, sender_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, conversationId, senderId, content, type, createdAt]
    );
    return { id, conversationId, senderId, content, type, createdAt };
  },

  getMessages: async (conversationId, limit = 50) => {
    const res = await pool.query(`
      SELECT 
        m.id,
        m.conversation_id,
        m.sender_id,
        m.content,
        m.type,
        m.created_at,
        u.username as sender_username
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
      LIMIT $2
    `, [conversationId, limit]);
    return res.rows;
  },

  getConversationParticipants: async (conversationId) => {
    const res = await pool.query(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = $1',
      [conversationId]
    );
    return res.rows.map(r => r.user_id);
  },

  verifyPassword: (password, hash) => {
    return bcrypt.compareSync(password, hash);
  },

  updateProfile: async (userId, updates) => {
    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.display_name !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(updates.display_name);
    }
    if (updates.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(updates.bio);
    }
    if (updates.avatar !== undefined) {
      fields.push(`avatar = $${idx++}`);
      values.push(updates.avatar);
    }
    if (updates.username !== undefined) {
      fields.push(`username = $${idx++}`);
      values.push(updates.username);
    }

    if (fields.length === 0) {
      return { success: true };
    }

    values.push(userId);
    await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      values
    );
    return { success: true };
  },

  deleteUser: async (id) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM messages WHERE sender_id = $1', [id]);
      await client.query('DELETE FROM conversation_participants WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      await client.query('COMMIT');
      return { success: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  getFullUser: async (id) => {
    const res = await pool.query('SELECT id, username, display_name, email, avatar, bio, status FROM users WHERE id = $1', [id]);
    return res.rows[0];
  },

  // ===================== CHANNEL OPERATIONS =====================
  createChannel: async (name, description, ownerId, username = null) => {
    const id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO channels (id, name, username, description, owner_id) VALUES ($1, $2, $3, $4, $5)',
        [id, name, username, description, ownerId]
      );
      await client.query(
        'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3)',
        [id, ownerId, 'admin']
      );
      await client.query('COMMIT');
      return { id, name, username, description, ownerId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  getUserChannels: async (userId) => {
    const res = await pool.query(`
      SELECT c.*, cm.role,
        (SELECT content FROM channel_messages WHERE channel_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM channel_messages WHERE channel_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
      FROM channels c
      JOIN channel_members cm ON c.id = cm.channel_id
      WHERE cm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST
    `, [userId]);
    return res.rows;
  },

  getChannelById: async (channelId) => {
    const res = await pool.query(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count,
        u.username as owner_username
      FROM channels c
      JOIN users u ON c.owner_id = u.id
      WHERE c.id = $1
    `, [channelId]);
    return res.rows[0];
  },

  searchChannels: async (query) => {
    const res = await pool.query(`
      SELECT c.id, c.name, c.username, c.description, c.avatar,
        (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
      FROM channels c
      WHERE c.username ILIKE $1 OR c.name ILIKE $2
      LIMIT 20
    `, [`%${query}%`, `%${query}%`]);
    return res.rows;
  },

  joinChannel: async (channelId, userId) => {
    await pool.query(
      'INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [channelId, userId, 'member']
    );
    return { success: true };
  },

  getChannelMessages: async (channelId, limit = 50) => {
    const res = await pool.query(`
      SELECT cm.*, u.username as sender_username
      FROM channel_messages cm
      JOIN users u ON cm.sender_id = u.id
      WHERE cm.channel_id = $1
      ORDER BY cm.created_at ASC
      LIMIT $2
    `, [channelId, limit]);
    return res.rows;
  },

  createChannelMessage: async (channelId, senderId, content, type = 'text') => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await pool.query(
      'INSERT INTO channel_messages (id, channel_id, sender_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, channelId, senderId, content, type, createdAt]
    );
    return { id, channelId, senderId, content, type, createdAt };
  },

  isChannelAdmin: async (channelId, userId) => {
    const res = await pool.query(
      'SELECT role FROM channel_members WHERE channel_id = $1 AND user_id = $2 AND role IN ($3, $4)',
      [channelId, userId, 'admin', 'owner']
    );
    return !!res.rows[0];
  },

  // ===================== GROUP OPERATIONS =====================
  createGroup: async (name, description, ownerId) => {
    const id = uuidv4();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO groups_table (id, name, description, owner_id) VALUES ($1, $2, $3, $4)',
        [id, name, description, ownerId]
      );
      await client.query(
        'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3)',
        [id, ownerId, 'admin']
      );
      await client.query('COMMIT');
      return { id, name, description, ownerId };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  getUserGroups: async (userId) => {
    const res = await pool.query(`
      SELECT g.*, gm.role,
        (SELECT content FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM group_messages WHERE group_id = g.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups_table g
      JOIN group_members gm ON g.id = gm.group_id
      WHERE gm.user_id = $1
      ORDER BY last_message_time DESC NULLS LAST
    `, [userId]);
    return res.rows;
  },

  getGroupById: async (groupId) => {
    const res = await pool.query(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
        u.username as owner_username
      FROM groups_table g
      JOIN users u ON g.owner_id = u.id
      WHERE g.id = $1
    `, [groupId]);
    return res.rows[0];
  },

  joinGroup: async (groupId, userId) => {
    await pool.query(
      'INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [groupId, userId, 'member']
    );
    return { success: true };
  },

  getGroupMessages: async (groupId, limit = 50) => {
    const res = await pool.query(`
      SELECT gm.*, u.username as sender_username
      FROM group_messages gm
      JOIN users u ON gm.sender_id = u.id
      WHERE gm.group_id = $1
      ORDER BY gm.created_at ASC
      LIMIT $2
    `, [groupId, limit]);
    return res.rows;
  },

  createGroupMessage: async (groupId, senderId, content, type = 'text') => {
    const id = uuidv4();
    const createdAt = new Date().toISOString();
    await pool.query(
      'INSERT INTO group_messages (id, group_id, sender_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, groupId, senderId, content, type, createdAt]
    );
    return { id, groupId, senderId, content, type, createdAt };
  },

  getGroupMembers: async (groupId) => {
    const res = await pool.query(`
      SELECT u.id, u.username, u.avatar, u.status, gm.role
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
    `, [groupId]);
    return res.rows;
  }
};

module.exports = { pool, dbHelpers };
