require('dotenv').config();
const mongoose = require('mongoose');

const [email, department] = process.argv.slice(2);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const users = mongoose.connection.db.collection('users');

    console.log('Database:', mongoose.connection.db.databaseName);
    console.log('All users:');

    const all = await users.find(
      {},
      {
        projection: {
          email: 1,
          role: 1,
          department: 1,
          firebaseUid: 1,
          uid: 1
        }
      }
    ).toArray();

    all.forEach(u => {
      console.log(
        `  ${u._id}  ${u.email}  role=${u.role}  dept=${u.department || '-'}  fbUid=${u.firebaseUid || '-'}  uid=${u.uid || '-'}`
      );
    });

    if (!email) {
      console.log(
        '\nUsage: node seed/makeOfficer.js <email> <department>'
      );
      await mongoose.disconnect();
      process.exit(0);
    }

    const res = await users.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          role: 'officer',
          department: department || 'water',
          designation: 'AEE'
        }
      }
    );

    console.log(
      `\nmatched=${res.matchedCount} modified=${res.modifiedCount}`
    );

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\nError:', error.message);

    await mongoose.disconnect();
    process.exit(1);
  }
})();