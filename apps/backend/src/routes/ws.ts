import type { FastifyPluginAsync } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

const wsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/events', { websocket: true }, (socket: WebSocket, request) => {
    fastify.log.info('WebSocket client connected');

    const subscriber = fastify.redis.duplicate();
    subscriber.subscribe('ws:broadcast', (err) => {
      if (err) fastify.log.error(err, 'Redis subscribe error');
    });

    subscriber.on('message', (_channel, message) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    });

    socket.on('close', () => {
      fastify.log.info('WebSocket client disconnected');
      subscriber.unsubscribe();
      subscriber.quit();
    });
  });
};

export default wsRoutes;
