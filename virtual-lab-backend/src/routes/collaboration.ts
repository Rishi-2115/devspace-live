import { Router } from 'express';

const router = Router();

// Mock collaboration routes
router.get('/:labId/session', (req, res) => {
  res.json({ sessionId: 'mock-session', participants: [] });
});

export { router as collaborationRouter };
