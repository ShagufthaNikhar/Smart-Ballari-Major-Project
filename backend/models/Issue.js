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
issueSchema.pre('save', async function () {

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

});

module.exports = mongoose.model('Issue', issueSchema);

