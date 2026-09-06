require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    const result = await mongoose.connection.db
      .collection('monuments')
      .deleteMany({});

    console.log('Deleted:', result.deletedCount, 'monuments');

    await mongoose.disconnect();
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });