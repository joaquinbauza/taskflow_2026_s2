import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireTaskProjectMember } from '../../middleware/membership';
import * as controller from './tasks.controller';
import commentsRouter from '../comments/comments.task-routes';

const router = Router();

router.use(authenticate);

router.get('/:taskId', requireTaskProjectMember('taskId'), controller.getOne);
router.get('/:taskId/history', requireTaskProjectMember('taskId'), controller.history);

router.patch('/:taskId', requireTaskProjectMember('taskId'), controller.update);
router.delete('/:taskId', requireTaskProjectMember('taskId'), controller.remove);

router.post('/:taskId/tags', requireTaskProjectMember('taskId'), controller.addTag);
router.delete('/:taskId/tags/:tagId', requireTaskProjectMember('taskId'), controller.removeTag);

router.use('/:taskId/comments', commentsRouter);

export default router;
