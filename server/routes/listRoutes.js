const express = require('express');
const router = express.Router();
const { createList, getListsByProject, updateList, deleteList } = require('../controllers/listController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createList);
router.get('/project/:projectId', getListsByProject);
router.put('/:id', updateList);
router.delete('/:id', deleteList);

module.exports = router;