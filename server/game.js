const SPACE_SIZE = 20;

const killUser = (data) => {
  const user = data;
  user.x = Math.round(Math.floor((Math.random() * (1280 - 50)) + 50) / SPACE_SIZE) * SPACE_SIZE;
  user.y = Math.round(Math.floor((Math.random() * (720 - 50)) + 50) / SPACE_SIZE) * SPACE_SIZE;
  user.numSegs = 0;
  user.segments = [];
  user.died = true;
};

const handleMovement = (sock, data) => {
  const socket = sock;
  socket.room.users[socket.user].xVel = data.x;
  socket.room.users[socket.user].yVel = data.y;
};

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
        io.sockets.in(room.name).emit('createParticle', { x: pellet.x + pellet.radius, y: pellet.y + pellet.radius });
        room.pellets.splice(j, 1);

        user.numSegs += room.segPerPel;
      }
    }

    // user collision
    for (let j = 0; j < keys.length; j++) {
      const other = room.users[keys[j]];

      if (user !== other && user.x === other.x && user.y === other.y) {
        killUser(user);
        killUser(other);
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

  const drawCalls = room.users;
  const drawPellets = room.pellets;
  io.sockets.in(room.name).emit('draw', { drawCalls, drawPellets });
};

// Creates pellets per update
const addPellets = (room) => {
  if (room.pellets.length > room.maxPellets) {
    return;
  }

  const numPellets = Math.floor(Math.random() * 7);
  for (let i = 0; i < numPellets; i++) {
    const tempPellet =
      { x: Math.round(Math.floor((Math.random() * (1280 - SPACE_SIZE))) / SPACE_SIZE) * SPACE_SIZE,
        y: Math.round(Math.floor((Math.random() * (720 - SPACE_SIZE))) / SPACE_SIZE) * SPACE_SIZE,
        radius: (SPACE_SIZE / 2),
        color: '#88498f' };
    room.pellets.push(tempPellet);
  }
};

const initUser = (sock, userRoom, username, color, io) => {
  const room = userRoom;
  const socket = sock;
  const time = new Date().getTime();
  const x = Math.round(Math.floor((Math.random() * (1280 - SPACE_SIZE))) / SPACE_SIZE) * SPACE_SIZE;
  const y = Math.round(Math.floor((Math.random() * (720 - SPACE_SIZE))) / SPACE_SIZE) * SPACE_SIZE;
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
    size: SPACE_SIZE,
    color,
    numSegs: 0,
    segments: [],
    died: false,
  };
  room.currUsers++;

  socket.on('disconnect', () => {
    socket.room.currUsers--;
    delete socket.room.users[socket.user];

    const players = [];
    const keys = Object.keys(socket.room.users);
    for (let i = 0; i < keys.length; i++) {
      const curPlayer = socket.room.users[keys[i]];
      const player = {
        name: curPlayer.user,
        color: curPlayer.color,
      };
      players.push(player);
    }
    io.sockets.in(socket.room.name).emit('populatePlayers', { players });
  });

  socket.on('move', (data) => {
    handleMovement(socket, data);
  });
};

module.exports.update = update;
module.exports.initUser = initUser;
module.exports.handleMovement = handleMovement;
module.exports.addPellets = addPellets;
