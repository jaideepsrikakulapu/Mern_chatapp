const router = require('express').Router();
const User = require('../models/User');

router.get('/', async (req, res) => {
  const users = await User.find({}, 'username _id');
  res.json(users);
});

module.exports = router;
