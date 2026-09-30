const io = require('socket.io')(3000, { cors: { origin: "*" } });
const rooms = new Map();
let remoteDevices = {}; // Store available remote devices

io.on('connection', (socket) => {
  socket.on('join-room', (data) => {
    const roomId = data.roomId;
    const role = data.role;
    const deviceName = data.deviceName || 'Unknown Device';

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    if (role === 'remote') {
      remoteDevices[socket.id] = { roomId: roomId, name: deviceName, socketId: socket.id };
      io.emit('remote-list-update', Object.values(remoteDevices)); // Broadcast to all hosts
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { hostId: null, remoteId: null };
      rooms.set(roomId, room);
    }

    if (role === 'host') room.hostId = socket.id;
    else if (role === 'remote') room.remoteId = socket.id;

    if (room.hostId && room.remoteId) {
      io.to(room.hostId).emit('peer-joined', { remoteId: room.remoteId });
      io.to(room.remoteId).emit('peer-joined', { hostId: room.hostId });
    }
  });

  socket.on('signal', (data) => {
    if (data.targetId) {
      io.to(data.targetId).emit('signal', { senderId: socket.id, signal: data.signal });
    }
  });

  socket.on('disconnect', () => {
    delete remoteDevices[socket.id];
    io.emit('remote-list-update', Object.values(remoteDevices));
    // ... (keep your existing room cleanup code here)
  });
});