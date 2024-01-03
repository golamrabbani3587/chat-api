// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const { timeStamp } = require('console');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(bodyParser.json({ type: 'application/json' }));
app.use(cors());

mongoose.connect('mongodb+srv://rrrr:Vdc32bBEok26kKuR@cluster0.nbrodly.mongodb.net/?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const userSchema = new mongoose.Schema({
  username: String,
  img: String,
  email: String,
  password: String,
  lastOnline: String
});

const User = mongoose.model('User', userSchema);


const ChatSchema = new mongoose.Schema({
  fromId: String,
  toId: String,
  message: String,
});

const Chat = mongoose.model('Chat', ChatSchema);



const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Token Required!',
    });
  }

  try {
    const decoded = jwt.verify(token, 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized. Token Expired!',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Unauthorized. Token Invalid!',
    });
  }
};

app.post('/register', async(req, res)=>{
  try{
    let body = req.body;
    let check = await User.findOne({username: body.username});
    if(check){
      res.json({msg: 'Username not available try another one.'})
    }
    else{
      var hashValue = await bcrypt.hash(body.password, saltRounds);
      body.password = hashValue;
      let newUser = await User.create(body);
      if(!newUser){
        res.json('Something went wrong');
      }
      else {
        res.json({'msg': 'saved', data: newUser})
      }
    }
  } catch(err){
    console.log(err);
  }
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if the user with the provided username exists
    const user = await User.findOne({ username });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if the provided password matches the hashed password in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // If username and password are correct, generate a token
    const token = jwt.sign({ userId: user._id }, 'your-secret-key', { expiresIn: '1h' });

    // Send the token in the response
    const resObj = {
      username: user.username,
      email: user.email,
      id: user._id,
      token: token
    }
    res.json({message: "Login success", resObj});

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/get-all-user', verifyToken, async (req, res) => {
  try {
    console.log( req.user, 'user logged');
    const loggedUserId = await req.user.userId;

    const data = await User.find({ _id: { $ne: loggedUserId } });

    res.json({ message: "Data found", users: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post('/get-message', async (req, res) => {
  try {
    console.log(req.body);

    // Check for messages where toId and fromId match
    let data = await Chat.find({
      $or: [
        { toId: req.body.fromId, fromId: req.body.toId },
        { toId: req.body.toId, fromId: req.body.fromId }
      ]
    });
    console.log(data, data);
    if (data) {
      res.json({ data });
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/get-all-user', [verifyToken], async (req, res) => {
  try {
    const data = await User.find();
    res.json({ message: 'Data found', users: data });
  } catch (err) {
    console.log(err);
  }
});

// server.jsa

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', ({ senderId, recipientId }) => {
    // Join the rooms corresponding to both sender and recipient user IDs
    socket.join(senderId);
    socket.join(recipientId);
    
    console.log('Joined rooms for sender and recipient');
  });

  // ... Other event handlers
  socket.on('chat message', async (messageData) => {
    const { fromUserId, toUserId, text } = messageData;
    io.to(fromUserId).emit('chat message', { text, fromUserId, toUserId });
    const newChat = await Chat.create({fromId: messageData.fromUserId, toId: messageData.toUserId, message: messageData.text })
    console.log(newChat, 'newChat');
    // Broadcast the message to both sender and recipient rooms
    // io.to(toUserId).emit('chat message', { text, fromUserId, toUserId });
  });
  

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(3001, () => {
  console.log('Express server listening on *:3001');
});
