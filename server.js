// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const fs = require('fs'); // Use the traditional callback-based 'fs' module

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_FILE = 'data.json';

// In-memory cache of data (synced with data.json)
let appData = {
  users: [],    // { username: '...', id: '...' }
  topics: [],   // { id: '...', name: '...' }
  ideas: []     // { id: '...', text: '...', timestamp: '...', topicId: '...', username: '...' }
};

let nextTopicId = 1;
let nextIdeaId = 1;

// --- Data Persistence Functions (using callbacks) ---

function readData(callback) {
  fs.readFile(DATA_FILE, 'utf8', (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.log('data.json not found, initializing with empty data.');
        appData = { users: [], topics: [], ideas: [] }; // Reset to empty if file not found
        writeData(() => { // Create the file
          callback();
        });
      } else {
        console.error('Error reading data.json:', err);
        callback(err);
      }
    } else {
      try {
        appData = JSON.parse(data);
        // Ensure IDs are correctly initialized from existing data
        nextTopicId = appData.topics.length > 0 ? Math.max(...appData.topics.map(t => parseInt(t.id) || 0)) + 1 : 1;
        nextIdeaId = appData.ideas.length > 0 ? Math.max(...appData.ideas.map(i => parseInt(i.id) || 0)) + 1 : 1;
        console.log('Data loaded from data.json');
        callback();
      } catch (parseErr) {
        console.error('Error parsing data.json:', parseErr);
        callback(parseErr);
      }
    }
  });
}

function writeData(callback) {
  fs.writeFile(DATA_FILE, JSON.stringify(appData, null, 2), 'utf8', (err) => {
    if (err) {
      console.error('Error writing data.json:', err);
      callback(err);
    } else {
      console.log('Data saved to data.json');
      callback();
    }
  });
}

// --- Initialize data on server start ---
readData(() => {
  console.log("Initial data state:", appData);
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Socket.IO connection handling ---
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Send initial data to the newly connected client
  // Ensure data is sent after it's loaded
  readData(() => { // Re-read to get latest state before sending
      socket.emit('initial_data', {
          topics: appData.topics,
          ideas: appData.ideas
      });
  });


  // --- Username Handling ---
  socket.on('check_username', (username, callback) => {
    const isTaken = appData.users.some(user => user.username.toLowerCase() === username.toLowerCase());
    callback(isTaken); // Send back true if taken, false if available
  });

  socket.on('register_username', (username, callback) => {
    const isTaken = appData.users.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (isTaken) {
      callback(false); // Username already taken
    } else {
      const newUserId = `user_${Date.now()}`; // Simple unique ID
      appData.users.push({ id: newUserId, username: username });
      writeData(() => {
        callback(true); // Username registered successfully
      });
    }
  });

  // --- Topic Handling ---
  socket.on('create_topic', (topicName, callback) => {
    const existingTopic = appData.topics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
    if (existingTopic) {
      callback({ success: false, topic: existingTopic, message: 'Topic already exists.' });
      return;
    }
    const newTopic = {
      id: String(nextTopicId++),
      name: topicName
    };
    appData.topics.push(newTopic);
    writeData(() => {
      io.emit('topic_created', newTopic); // Broadcast new topic to all clients
      callback({ success: true, topic: newTopic, message: 'Topic created successfully.' });
    });
  });

  // --- Idea Handling ---
  socket.on('new_idea', (data) => {
    const { ideaText, topicId, username } = data;
    const newIdea = {
      id: String(nextIdeaId++),
      text: ideaText,
      timestamp: new Date().toLocaleString(),
      topicId: topicId,
      username: username // Store the username with the idea
    };
    appData.ideas.unshift(newIdea); // Add to the beginning for newest first
    writeData(() => { // Persist the new idea
      io.emit('idea_added', newIdea); // Broadcast the new idea to ALL connected clients
      console.log('New idea received and broadcast:', newIdea);
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Glitch uses process.env.PORT for its assigned port
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});