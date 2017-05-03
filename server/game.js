const socketio = require('socket.io');

const SPACE_SIZE = 10;

// Moves users and checks collisions
const update = (room, io) => {
  const keys = Object.keys(room.users);
  for (let i = 0; i < keys.length; i++) {
    const user = room.users[keys[i]];

    // reset deaths
    if (user.died) user.died = false;

    // pellet collision
    for (let j = 0; j < room.pellets.length; j++) {
      const pellet = room.pellets[j];

      if (pellet.x === user.x && pellet.y === user.y) {
        room.pellets.splice(j, 1);

        user.numSegs++;
      }
    }

    // user collision
    for (let j = 0; j < keys.length; j++) {
      const other = room.users[keys[j]];

      if (user != other && user.x === other.x && user.y === other.y) {
        killUser(user);
        break;
      }

      for (let k = 0; k < other.segments.length; k++) {
        if (user.x === other.segments[k].x && user.y === other.segments[k].y) {
          killUser(user);
          break;
        }
      }
    }

    // bounds checking
    if (user.x < 0 || user.x >= 1280 || user.y < 0 || user.y >= 720) killUser(user);

    user.prevX = user.x;
    user.prevY = user.y;
    user.x += (user.xVel * SPACE_SIZE);
    user.y += (user.yVel * SPACE_SIZE);

    const tempSeg =
      { x: user.prevX,
        y: user.prevY };

    user.segments.push(tempSeg);

    if (user.segments.length > user.numSegs) {
      user.segments.splice(0, 1);
    }

    const time = new Date().getTime();
    user.lastUpdate = time;
  }

  let drawCalls = room.users;
  let drawPellets = room.pellets;
  io.sockets.in(room.name).emit('draw', { drawCalls, drawPellets });
};

const killUser = (user) => {
  user.x = Math.round(Math.floor((Math.random() * (1280 - 50)) + 50) / 10) * 10;
  user.y = Math.round(Math.floor((Math.random() * (720 - 50)) + 50) / 10) * 10; 
  user.numSegs = 0;
  user.segments = [];
  user.died = true;
}

// Creates pellets per update
const addPellets = (room) => {
  if (room.pellets.length > room.maxPellets) {
    return;
  }

  const numPellets = Math.floor(Math.random() * 7);
  for (let i = 0; i < numPellets; i++) {
    const tempPellet =
      { x: Math.round(Math.floor((Math.random() * (1280 - 10)) + 50) / 10) * 10,
        y: Math.round(Math.floor((Math.random() * (720 - 10)) + 50) / 10) * 10,
        radius: 5,
        color: '#7325f3' };
    room.pellets.push(tempPellet);
  }
};

const initUser = (socket, room, username, color) => {
  const time = new Date().getTime();
  const x = Math.round(Math.floor((Math.random() * (1280 - 50)) + 50) / 10) * 10;
  const y = Math.round(Math.floor((Math.random() * (720 - 50)) + 50) / 10) * 10;
  socket.user = username;
  socket.room = room;
  room.users[socket.user] =
  { user: username,
    lastUpdate: time,
    x,
    y,
    prevX: x,
    prevY: y,
    xVel: 1,
    yVel: 0,
    color: color,
    numSegs: 0,
    segments: [],
    died: false
  };  
  room.currUsers++;

  socket.on('disconnect', () => {
    socket.room.currUsers--;
    delete socket.room.users[socket.user];
  });

  socket.on('move', (data) => {
    handleMovement(socket, data);
  });
}

const handleMovement = (socket, data) => {
    socket.room.users[socket.user].xVel = data.x;
    socket.room.users[socket.user].yVel = data.y;
}

module.exports.update = update;
module.exports.initUser = initUser;
module.exports.handleMovement = handleMovement;
module.exports.addPellets = addPellets;