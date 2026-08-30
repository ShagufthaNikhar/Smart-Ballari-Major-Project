const express     = require('express');
const router      = express.Router();
const Issue       = require('../models/Issue');
const verifyToken = require('../middleware/verifyToken');
const requireRole = require('../middleware/requireRole');
const { upload, cloudinary } = require('../config/cloudinary');

// ── PUBLIC ROUTES (no auth needed) ──────────────────

// GET all issues — anyone can view map
router.get('/', async (req, res) => {
  const issues = await Issue.find().sort({ createdAt: -1 });
  res.json(issues);
});

// GET recent issues
router.get('/recent', async (req, res) => {
  const issues = await Issue.find().sort({ createdAt: -1 }).limit(10);
  res.json(issues);
});




// GET stats
router.get('/stats', async (req, res) => {
  const total    = await Issue.countDocuments();
  const open     = await Issue.countDocuments({ status: 'open' });
  const resolved = await Issue.countDocuments({ status: 'resolved' });
  const pending  = await Issue.countDocuments({ status: 'pending' });
  res.json({ total, open, resolved, pending });
});

// ── PROTECTED ROUTES ────────────────────────────────
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const issues = await Issue.find({ reportedBy: req.user.email })
      .sort({ createdAt: -1 });
    res.json(issues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// POST new issue — with optional image
router.post(
  '/',
  (req, res, next) => { console.log('1 before verifyToken'); next(); },
  verifyToken,
  (req, res, next) => { console.log('2 before requireRole'); next(); },
  requireRole('user', 'municipality', 'admin'),
  (req, res, next) => { console.log('3 before upload'); next(); },
  upload.single('image'),
  (req, res, next) => { console.log('4 before handler'); next(); },
  async (req, res) => {
    console.log('5 inside handler');
    try {
      const body = JSON.parse(req.body.data || '{}');

      const issueData = {
        ...body,
        reportedBy: req.dbUser.email
      };

      // Attach Cloudinary image if uploaded
      if (req.file) {
        issueData.imageUrl = req.file.path;         // Cloudinary URL
        issueData.imageRef = req.file.filename;     // public_id
      }

      const issue = new Issue(issueData);
      await issue.save();                           // triggers grievanceId hook
      res.status(201).json(issue);
    }  catch (err) {
      console.error(err.stack);
      res.status(400).json({ error: err.message });
    
    }
  }
);

// PATCH status — municipality + admin only
router.patch(
  '/:id/status',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const issue = await Issue.findByIdAndUpdate(
        req.params.id,
        { status: req.body.status },
        { new: true }
      );
      res.json(issue);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);


router.get('/track/:grievanceId', async (req, res) => {
  try {
    const issue = await Issue.findOne({
      grievanceId: req.params.grievanceId.toUpperCase()
    });
    if (!issue) return res.status(404).json({ error: 'Grievance ID not found' });
    res.json(issue);
  } catch (err) {
  console.error(err.stack);   // ← add this
  res.status(400).json({ error: err.message });
}
});

// DELETE — also remove from Cloudinary
router.delete(
  '/:id',
  verifyToken,
  requireRole('admin'),
  async (req, res) => {
    try {
      const issue = await Issue.findById(req.params.id);
      if (!issue) return res.status(404).json({ error: 'Not found' });

      // Delete image from Cloudinary if exists
      if (issue.imageRef) {
        await cloudinary.uploader.destroy(issue.imageRef);
      }

      await Issue.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

module.exports = router;