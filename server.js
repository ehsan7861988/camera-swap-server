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

    // Track remote devices for the list
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

    // Setup room
    let room = rooms.get(roomId);
    if (!room) {
      room = { hostId: null, remoteId: null };
      rooms.set(roomId, room);
    }

    if (role === 'host') {
      room.hostId = socket.id;
      // Send current device list to the newly joined host
      socket.emit('remote-list-update', Object.values(remoteDevices));
    } else if (role === 'remote') {
      room.remoteId = socket.id;
    }

    // Notify both peers if they are now together in the room
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

    const roomId = socket.roomId;
    const role = socket.role;

    if (roomId) {
      const room = rooms.get(roomId);
      
      // Send peer-disconnected DIRECTLY to the other peer (not the room)
      if (room) {
        if (role === 'host' && room.remoteId) {
          io.to(room.remoteId).emit('peer-disconnected', { role: 'host' });
        } else if (role === 'remote' && room.hostId) {
          io.to(room.hostId).emit('peer-disconnected', { role: 'remote' });
        }
      }

      // Clean up the room
      if (room) {
        if (room.hostId === socket.id) room.hostId = null;
        if (room.remoteId === socket.id) room.remoteId = null;
        if (!room.hostId && !room.remoteId) rooms.delete(roomId);
      }
    }

    // Remove from remote device list and broadcast
    delete remoteDevices[socket.id];
    io.emit('remote-list-update', Object.values(remoteDevices));
  });
});
