const dns = require('dns');

// CRITICAL FIX: Force IPv4 for all connections to avoid ENETUNREACH on Render
// This overrides the system DNS lookup to always request IPv4 addresses
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    } else if (!options) {
        options = {};
    }
    options.family = 4; // Force IPv4
    options.hints = (options.hints || 0) | dns.ADDRCONFIG | dns.V4MAPPED;
    return originalLookup(hostname, options, callback);
};

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { dbHelpers } = require('./database');
const { setupWebSocket } = require('./websocket');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files for web client
app.use(express.static(path.join(__dirname, '..')));

// Auth routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const existingUser = await dbHelpers.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const user = await dbHelpers.createUser(username, email, password);
        res.json({ success: true, user });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        const user = await dbHelpers.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = dbHelpers.verifyPassword(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// User routes
app.get('/api/users/search', async (req, res) => {
    try {
        const { q, userId } = req.query;
        const users = await dbHelpers.searchUsers(q || '', userId);
        res.json(users);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/api/users/:id', async (req, res) => {
    try {
        const user = await dbHelpers.getFullUser(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

// Update user profile
app.put('/api/users/:id/profile', async (req, res) => {
    try {
        const { display_name, bio, avatar, username } = req.body;
        const result = await dbHelpers.updateProfile(req.params.id, {
            display_name,
            bio,
            avatar,
            username
        });
        const updatedUser = await dbHelpers.getFullUser(req.params.id);
        res.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Delete user account
app.delete('/api/users/:id', async (req, res) => {
    try {
        const result = await dbHelpers.deleteUser(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Conversation routes
app.post('/api/conversations', async (req, res) => {
    try {
        const { userId1, userId2 } = req.body;
        const conversationId = await dbHelpers.createConversation(userId1, userId2);
        res.json({ success: true, conversationId });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Failed to create conversation' });
    }
});

app.get('/api/conversations/:userId', async (req, res) => {
    try {
        const conversations = await dbHelpers.getConversations(req.params.userId);
        res.json(conversations);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});

// Message routes
app.get('/api/messages/:conversationId', async (req, res) => {
    try {
        const messages = await dbHelpers.getMessages(req.params.conversationId);
        res.json(messages);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// ===================== CHANNEL ROUTES =====================
// Create channel
app.post('/api/channels', async (req, res) => {
    try {
        const { name, description, ownerId, username } = req.body;

        // Validate user exists before creating channel
        const user = await dbHelpers.getUserById(ownerId);
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден. Пожалуйста, перезайдите в аккаунт.' });
        }

        const channel = await dbHelpers.createChannel(name, description, ownerId, username);
        res.json({ success: true, channel });
    } catch (error) {
        console.error('Create channel error:', error);
        if (error.code === '23505') {
            res.status(400).json({ error: 'Этот username уже занят' });
        } else {
            res.status(500).json({ error: 'Ошибка создания канала' });
        }
    }
});

// Get user's channels
app.get('/api/channels/user/:userId', async (req, res) => {
    try {
        const channels = await dbHelpers.getUserChannels(req.params.userId);
        res.json(channels);
    } catch (error) {
        console.error('Get channels error:', error);
        res.status(500).json({ error: 'Failed to get channels' });
    }
});

// Search channels
app.get('/api/channels/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json([]);
        const channels = await dbHelpers.searchChannels(q);
        res.json(channels);
    } catch (error) {
        console.error('Search channels error:', error);
        res.status(500).json({ error: 'Failed to search channels' });
    }
});

// Get channel by ID
app.get('/api/channels/:channelId', async (req, res) => {
    try {
        const channel = await dbHelpers.getChannelById(req.params.channelId);
        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }
        res.json(channel);
    } catch (error) {
        console.error('Get channel error:', error);
        res.status(500).json({ error: 'Failed to get channel' });
    }
});

// Get channel messages
app.get('/api/channels/:channelId/messages', async (req, res) => {
    try {
        const messages = await dbHelpers.getChannelMessages(req.params.channelId);
        res.json(messages);
    } catch (error) {
        console.error('Get channel messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Post channel message (only admins)
app.post('/api/channels/:channelId/messages', async (req, res) => {
    try {
        const { senderId, content, type } = req.body;
        const isAdmin = await dbHelpers.isChannelAdmin(req.params.channelId, senderId);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can post in channels' });
        }
        const message = await dbHelpers.createChannelMessage(req.params.channelId, senderId, content, type);
        res.json({ success: true, message });
    } catch (error) {
        console.error('Post channel message error:', error);
        res.status(500).json({ error: 'Failed to post message' });
    }
});

// ===================== GROUP ROUTES =====================
// Create group
app.post('/api/groups', async (req, res) => {
    try {
        const { name, description, ownerId } = req.body;

        // Validate user exists before creating group
        const user = await dbHelpers.getUserById(ownerId);
        if (!user) {
            return res.status(401).json({ error: 'Пользователь не найден. Пожалуйста, перезайдите в аккаунт.' });
        }

        const group = await dbHelpers.createGroup(name, description, ownerId);
        res.json({ success: true, group });
    } catch (error) {
        console.error('Create group error:', error);
        res.status(500).json({ error: 'Ошибка создания группы' });
    }
});

// Get user's groups
app.get('/api/groups/user/:userId', async (req, res) => {
    try {
        const groups = await dbHelpers.getUserGroups(req.params.userId);
        res.json(groups);
    } catch (error) {
        console.error('Get groups error:', error);
        res.status(500).json({ error: 'Failed to get groups' });
    }
});

// Get group by ID
app.get('/api/groups/:groupId', async (req, res) => {
    try {
        const group = await dbHelpers.getGroupById(req.params.groupId);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.json(group);
    } catch (error) {
        console.error('Get group error:', error);
        res.status(500).json({ error: 'Failed to get group' });
    }
});

// Get group messages
app.get('/api/groups/:groupId/messages', async (req, res) => {
    try {
        const messages = await dbHelpers.getGroupMessages(req.params.groupId);
        res.json(messages);
    } catch (error) {
        console.error('Get group messages error:', error);
        res.status(500).json({ error: 'Failed to get messages' });
    }
});

// Post group message (all members)
app.post('/api/groups/:groupId/messages', async (req, res) => {
    try {
        const { senderId, content, type } = req.body;
        const message = await dbHelpers.createGroupMessage(req.params.groupId, senderId, content, type);
        res.json({ success: true, message });
    } catch (error) {
        console.error('Post group message error:', error);
        res.status(500).json({ error: 'Failed to post message' });
    }
});

// Get group members
app.get('/api/groups/:groupId/members', async (req, res) => {
    try {
        const members = await dbHelpers.getGroupMembers(req.params.groupId);
        res.json(members);
    } catch (error) {
        console.error('Get group members error:', error);
        res.status(500).json({ error: 'Failed to get members' });
    }
});

// Setup WebSocket
setupWebSocket(server);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║         M-essenger Server Running             ║
╠═══════════════════════════════════════════════╣
║  HTTP Server: http://localhost:${PORT}           ║
║  WebSocket:   ws://localhost:${PORT}             ║
╚═══════════════════════════════════════════════╝
  `);
});
