const http = require('http');
const fs = require('fs');
const socketio = require('socket.io');

const port = process.env.PORT || process.env.NODE_PORT || 3000;

const index = fs.readFileSync(`${__dirname}/../hosted/index.html`);
const cssFile = fs.readFileSync(`${__dirname}/../hosted/clientStyle.css`);
const scriptFile = fs.readFileSync(`${__dirname}/../hosted/clientScript.js`);

const onRequest = (request, response) => {
  switch (request.url) {
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

const users = {};
const pellets = [];
const MAX_PELLETS = 50;
const SPACE_SIZE = 10;

// Moves users and checks collisions
const update = () => {
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    const user = users[keys[i]];
    
    // pellet collision
    for (let j = 0; j < pellets.length; j++) {
      const pellet = pellets[j];

      if (pellet.x === user.x && pellet.y === user.y) {
        pellets.splice(j, 1);
        
        user.numSegs++;
      }
    }

    user.prevX = user.x;
    user.prevY = user.y;
    user.x += (user.xVel * SPACE_SIZE);
    user.y += (user.yVel * SPACE_SIZE);

    const tempSeg =
      { x: user.prevX,
        y: user.prevY };

    user.segments.push(tempSeg);

    if (user.segments.length > user.numSegs)
    {
      user.segments.splice(0, 1)
    }

    const time = new Date().getTime();
    user.lastUpdate = time;
  }

  io.sockets.in('room1').emit('draw', { users, pellets });
};

// Creates pellets per update
const addPellets = () => {
  if (pellets.length > MAX_PELLETS) {
    return;
  }

  const numPellets = Math.floor(Math.random() * 10);
  for (let i = 0; i < numPellets; i++) {
    const tempPellet =
      { x: Math.round(Math.floor((Math.random() * (1280 - 10)) + 50) / 10) * 10,
        y: Math.round(Math.floor((Math.random() * (720 - 10)) + 50) / 10) * 10,
        radius: 5,
        color: '#7325f3' };
    pellets.push(tempPellet);
  }
};

// Called when a socket joins
const onJoined = (sock) => {
  const socket = sock;
  socket.on('join', (data) => {
    socket.join('room1');
    // init user
    const time = new Date().getTime();
    const x = Math.round(Math.floor((Math.random() * (1280 - 50)) + 50) / 10) * 10;
    const y = Math.round(Math.floor((Math.random() * (720 - 50)) + 50) / 10) * 10;
    socket.user = data.user;
    users[socket.user] =
    { user: data.user,
      lastUpdate: time,
      x,
      y,
      prevX: x,
      prevY: y,
      xVel: 1,
      yVel: 0,
      color: data.color,
      numSegs: 0,
      segments: []
     };
    socket.emit('connected', null);
  });
  // apply movement
  socket.on('move', (data) => {
    users[socket.user].xVel = data.x;
    users[socket.user].yVel = data.y;
  });
};

// Handle disconnects
const onDisconnect = (sock) => {
  const socket = sock;

  socket.on('disconnect', () => {
    delete users[socket.user];
  });
};

io.sockets.on('connection', (socket) => {
  onJoined(socket);
  onDisconnect(socket);
});

// Set update frequencies
setInterval(update, 500);
setInterval(addPellets, 5000);