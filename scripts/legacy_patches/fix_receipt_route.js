const fs = require('fs');
let content = fs.readFileSync('src/app/api/receipts/route.ts', 'utf8');

const importStatement = `import Receipt from '@/models/Receipt';
import Lead from '@/models/Lead';`;

content = content.replace(`import Receipt from '@/models/Receipt';`, importStatement);

const hook = `    // 5. Création et sauvegarde du document
    const newReceipt = await Receipt.create({
      operatorName,
      clientDetails: {
        nom,
        telephone,
        ...(classe && { classe }),
        ...(email && { email }),
        ...(familyGroup && { familyGroup }),
      },
      ...(paymentMode && { paymentMode }),
      ...(paymentDetails && { paymentDetails }),
      ...(paymentDate && { paymentDate: new Date(paymentDate) }),
      amount,
      notes,
      gDriveFileId: fileId,
      gDriveViewUrl: webViewLink,
      status: 'PENDING',
    });

    // --- INTEGRATION CRM: AUTOMATIC APPROVAL ---
    // If a lead exists with this phone number, update its status to 'Approved'
    try {
      if (telephone) {
        // Strip spaces from phone just in case to match DB format
        const cleanPhone = telephone.replace(/\\s+/g, '');
        const lead = await Lead.findOne({ phone: cleanPhone });
        if (lead && lead.status !== 'Approved') {
          lead.status = 'Approved';
          lead.notes.push({
            text: \`Inscription validée automatiquement via ReceiptHub (Montant: \${amount} DT)\`,
            addedBy: 'Système',
            addedAt: new Date()
          });
          await lead.save();
          console.log(\`Lead \${lead.id} automatically approved via receipt creation.\`);
        }
      }
    } catch (crmErr) {
      console.error('Failed to update CRM lead automatically:', crmErr);
    }
    // -------------------------------------------
`;

content = content.replace(/    \/\/ 5\. Création et sauvegarde du document[\s\S]*?status: 'PENDING',\n    \}\);/, hook);
fs.writeFileSync('src/app/api/receipts/route.ts', content);
