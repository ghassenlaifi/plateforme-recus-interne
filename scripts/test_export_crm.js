const mongoose = require('mongoose');
const xlsx = require('xlsx');

const URI = 'mongodb+srv://ghassenlaifii_db_user:v5S91ZMkwGXEL1P4@receipthub-cluster.aqr9ofq.mongodb.net/?appName=ReceiptHub-Cluster';

async function testExport() {
  await mongoose.connect(URI);
  const db = mongoose.connection.db;

  for (const crmType of ['elios', 'formatic']) {
    const leads = await db.collection('leads').find({ crmType }).sort({ date: -1 }).toArray();
    console.log(`\nTesting export for ${crmType}: ${leads.length} records found in MongoDB`);

    const data = leads.slice(0, 10).map(lead => {
      return {
        'ID': lead.id || '',
        'Prenom': lead.firstName || '',
        'Nom': lead.lastName || '',
        'Telephone': lead.phone || '',
        'Offre': lead.offer || '',
        'Source': lead.source || '',
        'Grade': lead.grade || '',
        'Specialite': lead.section || '',
        'Statut': lead.status || '',
        'Operateur': lead.staff || 'Système',
        'DateCreation': lead.date,
        'DerniereMiseAJour': lead.updatedAt,
        'NbNotes': lead.notes ? lead.notes.length : 0
      };
    });

    console.log(`Sample exported rows for ${crmType}:`);
    console.table(data);
  }

  await mongoose.disconnect();
  console.log('\n✅ Test d\'export validé avec succès !');
}

testExport().catch(console.error);

