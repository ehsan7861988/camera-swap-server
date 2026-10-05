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
    const location = data.location || 'Unknown Location';
    const country = data.country || 'Unknown Country';
    const latitude = data.latitude || 0;
    const longitude = data.longitude || 0;

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = role;

    if (role === 'remote') {
      remoteDevices[socket.id] = { 
        roomId: roomId, 
        name: deviceName, 
        location: location,
        country: country,
        latitude: latitude,
        longitude: longitude,
        socketId: socket.id 
      };
      io.emit('remote-list-update', Object.values(remoteDevices));
    }

    let room = rooms.get(roomId);
    if (!room) {
      room = { hostId: null, remoteId: null };
      rooms.set(roomId, room);
    }

    if (role === 'host') {
      room.hostId = socket.id;
      socket.emit('remote-list-update', Object.values(remoteDevices));
    } else if (role === 'remote') {
      room.remoteId = socket.id;
    }

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
    console.log('Client disconnected:', socket.id);

    // Notify the other peer in the room
    const roomId = socket.roomId;
    if (roomId) {
      if (socket.role === 'host') {
        io.to(roomId).emit('peer-disconnected', { role: 'host' });
      } else if (socket.role === 'remote') {
        io.to(roomId).emit('peer-disconnected', { role: 'remote' });
      }
    }

    delete remoteDevices[socket.id];
    io.emit('remote-list-update', Object.values(remoteDevices));

    // Clean up room
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
