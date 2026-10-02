const io = require('socket.io')(3000, { cors: { origin: "*" } });

const rooms = new Map();
let remoteDevices = {}; 

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('join-room', (data) => {
    console.log('Received data:', data); 
    
    const roomId = data.roomId;
    const role = data.role;
    const deviceName = data.deviceName || 'Unknown Device';

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    // If a Remote device joins, add it to the list and broadcast the list to all Hosts
    if (role === 'remote') {
      remoteDevices[socket.id] = { 
        roomId: roomId, 
        name: deviceName, 
        socketId: socket.id 
      };
      io.emit('remote-list-update', Object.values(remoteDevices));
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { hostId: null, remoteId: null };
      rooms.set(roomId, room);
    }

    // If a Host device joins, send it the CURRENT list of Remote devices immediately
    if (role === 'host') {
      room.hostId = socket.id;
      socket.emit('remote-list-update', Object.values(remoteDevices));
    } else if (role === 'remote') {
      room.remoteId = socket.id;
    }

    // If both are in the same room, tell them to connect to each other
    if (room.hostId && room.remoteId) {
      io.to(room.hostId).emit('peer-joined', { remoteId: room.remoteId });
      io.to(room.remoteId).emit('peer-joined', { hostId: room.hostId });
    }
  });

  socket.on('signal', (data) => {
    if (data.targetId) {
      io.to(data.targetId).emit('signal', { 
        senderId: socket.id, 
        signal: data.signal 
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove from remote list
    delete remoteDevices[socket.id];
    io.emit('remote-list-update', Object.values(remoteDevices));
    
    // Clean up room
    const roomId = socket.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        if (room.hostId === socket.id) room.hostId = null;
        if (room.remoteId === socket.id) room.remoteId = null;
        if (!room.hostId && !room.remoteId) rooms.delete(roomId);
      }
    }
  });
});
