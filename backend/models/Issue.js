const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String },

  category:    {
    type: String,
    enum: ['road', 'water', 'electric', 'sanitation', 'other'],
    default: 'other'
  },

  status: {
    type: String,
    enum: ['open', 'pending', 'in-progress','resolved'],
    default: 'open'
  },

  location: {
    coordinates: {
      lat: Number,
      lng: Number
    },
    address: {type:String}
  },

  imageUrl:   { type: String },  
  imageRef:   { type: String },   

  reportedBy: { type: String },
  assignedTo: { type: String },  

  grievanceId:{ type: String, unique: true },  // e.g. SB-2024-00042
  

  timeline: [
    {
      status:    { type: String },
      message:   { type: String },
      updatedBy: { type: String },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  flags: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  aiTagged: { type: Boolean, default: false },
aiConf:   { type: Number } ,  // AI confidence percentage


// Add inside issueSchema
upvotes:     { type: [String], default: [] },  // array of UIDs
downvotes:   { type: [String], default: [] },  // array of UIDs
voteScore:   { type: Number,   default: 0   },  // upvotes - downvotes
verified:    { type: Boolean,  default: false }, // auto at threshold
priority:    {
  type:    String,
  enum:    ['low', 'medium', 'high', 'critical'],
  default: 'medium'
},
reporterTrustScore: { type: Number, default: 50 }  // snapshot at report time
});


  // Auto-add first timeline entry on create
issueSchema.pre('save', async function (next) {

  if (!this.grievanceId) {
    const count = await mongoose.model('Issue').countDocuments();
    const year  = new Date().getFullYear();
    this.grievanceId = `SB-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // First timeline entry
  if (this.isNew) {
    this.timeline.push({
      status:    'open',
      message:   'Issue reported and registered.',
      updatedBy: this.reportedBy || 'citizen',
      timestamp: new Date()
    });
  }
  

  // GET by grievance ID — public
router.get('/track/:grievanceId', async (req, res) => {
  try {
    const issue = await Issue.findOne({
      grievanceId: req.params.grievanceId.toUpperCase()
    });
    if (!issue) {
      return res.status(404).json({ error: 'Grievance ID not found' });
    }
    res.json(issue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH status + push to timeline
router.patch(
  '/:id/status',
  verifyToken,
  requireRole('municipality', 'admin'),
  async (req, res) => {
    try {
      const { status, message } = req.body;

      const statusMessages = {
        'open':        'Issue re-opened.',
        'in-progress': 'Issue is being worked on by municipality.',
        'resolved':    'Issue has been resolved. Thank you for reporting!'
      };

      const issue = await Issue.findByIdAndUpdate(
        req.params.id,
        {
          status,
          updatedAt: new Date(),
          $push: {
            timeline: {
              status,
              message:   message || statusMessages[status],
              updatedBy: req.dbUser.email,
              timestamp: new Date()
            }
          }
        },
        { new: true }
      );

      res.json(issue);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

  next();
});

module.exports = mongoose.model('Issue', issueSchema);

