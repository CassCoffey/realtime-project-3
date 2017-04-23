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
const MAX_RADIUS = 200;
const MIN_RADIUS = 10;
const MAX_SPEED = 3;
const MIN_SPEED = 0.6;

// Creates pellets per update
const addPellets = () => {
  if (pellets.length > MAX_PELLETS) {
    return;
  }

  const numPellets = Math.floor(Math.random() * 10);
  for (let i = 0; i < numPellets; i++) {
    const tempPellet =
      { x: Math.floor(Math.random() * (1280 - 10)),
        y: Math.floor(Math.random() * (720 - 10)),
        width: 10,
        height: 10,
        color: '#7325f3' };
    pellets.push(tempPellet);
  }
};

// Moves users and checks collisions
const update = () => {
  const keys = Object.keys(users);
  for (let i = 0; i < keys.length; i++) {
    const user = users[keys[i]];

    if (user.y < 0 + user.radius) {
      user.y = 0 + user.radius;
    }
    if (user.y > 720 - user.radius) {
      user.y = 720 - user.radius;
    }
    if (user.x < 0 + user.radius) {
      user.x = 0 + user.radius;
    }
    if (user.x > 1280 - user.radius) {
      user.x = 1280 - user.radius;
    }

    // pellet collision
    for (let j = 0; j < pellets.length; j++) {
      const pellet = pellets[j];

      const dx = user.x - (pellet.x + (pellet.width / 2));
      const dy = user.y - (pellet.y + (pellet.height / 2));
      const distance = Math.sqrt((dx * dx) + (dy * dy));

      if (distance < user.radius + (pellet.width / 2)) {
        pellets.splice(j, 1);
        if (user.radius < MAX_RADIUS) {
          user.radius += 2;
        }
        if (user.speed > MIN_SPEED) {
          user.speed -= 0.1;
        }
      }
    }

    // User Collision
    for (let j = 0; j < keys.length; j++) {
      const otherUser = users[keys[j]];

      const dx = user.x - otherUser.x;
      const dy = user.y - otherUser.y;
      const distance = Math.sqrt((dx * dx) + (dy * dy));

      if (user !== otherUser && distance < user.radius + otherUser.radius) {
        if (user.radius > otherUser.radius && otherUser.radius > MIN_RADIUS) {
          if (user.radius < MAX_RADIUS) {
            user.radius += 1;
          }
          if (user.speed > MIN_SPEED) {
            user.speed -= 0.05;
          }
        } else if (user.radius < otherUser.radius && user.radius > MIN_RADIUS) {
          user.radius -= 1;

          if (user.speed < MAX_SPEED) {
            user.speed += 0.05;
          }
        } else {
          const angle = Math.atan2(dy, dx);
          const nx = Math.cos(angle) * user.speed;
          const ny = Math.sin(angle) * user.speed;
          user.x += nx;
          user.y += ny;
        }
      }
    }

    const time = new Date().getTime();
    user.lastUpdate = time;
  }

  io.sockets.in('room1').emit('draw', { users, pellets });
};

// Called when a socket joins
const onJoined = (sock) => {
  const socket = sock;
  socket.on('join', (data) => {
    socket.join('room1');
    // init user
    const time = new Date().getTime();
    const x = Math.floor((Math.random() * (1280 - 50)) + 50);
    const y = Math.floor((Math.random() * (720 - 50)) + 50);
    socket.user = data.user;
    users[socket.user] =
    { user: data.user,
      lastUpdate: time,
      x,
      y,
      radius: 12,
      speed: 4,
      color: data.color };
    socket.emit('connected', null);
  });
  // Normalize and apply movement
  socket.on('move', (data) => {
    // snippet from http://stackoverflow.com/questions/3592040/javascript-function-that-works-like-actionscripts-normalize1
    const x = data.x;
    const y = data.y;
    if ((x === 0 && y === 0) || users[socket.user].speed === 0) {
      users[socket.user].x += 0;
      users[socket.user].y += 0;
    } else {
      const angle = Math.atan2(y, x);
      const nx = Math.cos(angle) * users[socket.user].speed;
      const ny = Math.sin(angle) * users[socket.user].speed;
      users[socket.user].x += nx;
      users[socket.user].y += ny;
    }
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
setInterval(update, 1000 / 30);
setInterval(addPellets, 5000);
