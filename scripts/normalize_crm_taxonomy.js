const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI || 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';

const GRADE_MAP = {
  'Baccalauréat': 'BAC',
  '3e secondaire': '3ème Année',
  '2e secondaire': '2ème Année',
  '1re secondaire': '1ère Année',
  '9e année': '9ème de Base',
  '8e année': '8ème de Base',
  '7e année': '7ème de Base',
  'Bac': 'BAC',
  '3eme': '3ème Année',
  '2eme': '2ème Année',
  '1er': '1ère Année',
  '9eme': '9ème de Base',
  '7eme': '7ème de Base',
};

const SPEC_MAP = {
  'Sciences techniques': 'Technique',
  'Économie et gestion': 'Économie',
  'Sciences expérimentales': 'Science',
  'Tech': 'Technique',
  'Eco': 'Économie',
  'Sci': 'Science',
  'General': 'Sans section',
};

async function main() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;
  const sessions = await db.collection('sessions').find({}).toArray();
  for (const s of sessions) {
    const newLevel = GRADE_MAP[s.level] || s.level;
    const newSection = SPEC_MAP[s.section] || s.section;
    await db.collection('sessions').updateOne(
      { _id: s._id },
      { $set: { level: newLevel, section: newSection } }
    );
    console.log(`Updated: ${s.subject} -> ${newLevel} / ${newSection}`);
  }
  await mongoose.disconnect();
  console.log('Finished updating MongoDB sessions with CRM taxonomy.');
}

main().catch(console.error);
