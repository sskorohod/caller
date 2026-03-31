import type { FastifyPluginAsync } from 'fastify';

const webhookRoutes: FastifyPluginAsync = async (app) => {
  await app.register(import('./twilio.js'), { prefix: '/twilio' });
  await app.register(import('./media-stream.js'), { prefix: '/ws' });
};

export default webhookRoutes;
