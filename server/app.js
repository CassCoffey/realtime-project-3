const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');
const gameLogic = require('./game.js');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const cssFile = fs.readFileSync(`${__dirname}/../hosted/clientStyle.css`);
const scriptFile = fs.readFileSync(`${__dirname}/../hosted/clientScript.js`);
const audioFile = fs.readFileSync(`${__dirname}/../hosted/collect.wav`);

const onRequest = (request, response) => {
  switch (request.url) {
    case '/collect.wav':
      response.writeHead(200, { 'Content-Type': 'audio/wav' });
      response.write(audioFile);
      break;

    case '/clientStyle.css':
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.write(cssFile);
      break;

    case '/clientScript.js':
      response.writeHead(200, { 'Content-Type': 'text/babel' });
      response.write(scriptFile);
      break;

    default:
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.write(index);
  }

  response.end();
};

const app = http.createServer(onRequest).listen(port);

const io = socketio(app);


const rooms = {};
let updateInt = 0;

rooms.Default =
{ name: 'Default',
  users: {},
  currUsers: 0,
  maxUsers: 10,
  pellets: [],
  maxPellets: 50,
  private: false,
};

// Update Function
const update = () => {
  const keys = Object.keys(rooms);

  for (let i = 0; i < keys.length; i++) {
    const curRoom = rooms[keys[i]];
    gameLogic.update(curRoom, io);

    // pellets are updated less frequently
    if (updateInt === 15) {
      gameLogic.addPellets(curRoom);
    }
  }

  if (updateInt === 15) updateInt = 0;

  updateInt++;
};

// Called when a socket joins
const onJoined = (sock) => {
  const socket = sock;

  socket.on('getRooms', () => {
    socket.emit('recieveRooms', rooms);
  });

  socket.on('createRoom', (data) => {
    rooms[data.roomName] =
    { name: data.roomName,
      users: {},
      currUsers: 0,
      maxUsers: parseInt(data.maxPlayers, 10),
      pellets: [],
      maxPellets: parseInt(data.maxPellets, 10),
      private: false,
    };

    socket.join(data.roomName);

    gameLogic.initUser(socket, rooms[data.roomName], data.user, data.color);

    socket.emit('createdRoom', null);
  });

  socket.on('joinRoom', (data) => {
    socket.join(data.currentRoom);
    const room = rooms[data.currentRoom];

    // room full
    if (room.currUsers === room.maxUsers) {
      // tell them
    } else {
      gameLogic.initUser(socket, room, data.user, data.color);

      socket.emit('joinedRoom', null);
    }
  });
};

io.sockets.on('connection', (socket) => {
  onJoined(socket);
});

// init game
setInterval(update, 300);
