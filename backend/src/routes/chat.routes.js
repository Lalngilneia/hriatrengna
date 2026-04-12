const express = require('express');
const router  = express.Router();
const chat    = require('../controllers/chat.controller');
const auth    = require('../middleware/admin.middleware');

// Public — no auth (AI chat widget used by anyone on the site)
router.post('/message',  chat.chat);
router.post('/escalate', chat.escalate);

// Protected — require admin auth (conversation management)
router.use(auth);
router.get('/conversations',        chat.listConversations);
router.get('/conversations/:id',    chat.getConversation);
router.delete('/conversations/:id', chat.deleteConversation);

module.exports = router;
