import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { chatRateLimit } from '../middleware/rateLimit.js';

export const chatRoutes = Router();

chatRoutes.post('/', chatRateLimit, chatController);
