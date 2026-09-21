const { google } = require('googleapis');
const readline = require('readline');

// Vos identifiants injectés directement en dur pour le script
const CLIENT_ID = '178939851798-qu071i3j8fbv193vc1gkrf4uggfjbs5t.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob' // Mode application de bureau
);

const scopes = ['https://www.googleapis.com/auth/drive.file'];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes,
});

console.log('\n=== ÉTAPE DE VALIDATION OAUTH2 ===\n');
console.log('1. Ouvrez ce lien dans votre navigateur web :\n');
console.log(url);
console.log('\n2. Connectez-vous avec votre compte Google, autorisez l\'accès.');
console.log('3. Copiez le code de validation affiché par Google.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('Collez le code de validation ici : ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n========================================');
    console.log('SUCCÈS ! Voici votre REFRESH_TOKEN :');
    console.log(tokens.refresh_token);
    console.log('========================================\n');
    console.log('Copiez cette valeur et ajoutez-la dans votre .env.local !\n');
  } catch (error) {
    console.error('Erreur lors de la récupération du token :', error.message);
  }
});