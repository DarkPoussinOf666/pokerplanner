import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 500,
      timeout: 10000
    });
  }
  return socket;
}

// Pre-initialize socket connection as soon as module is imported
getSocket();
