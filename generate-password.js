// Script to generate bcrypt password hash
// Usage: node generate-password.js <password>

import bcrypt from 'bcryptjs';

const password = process.argv[2] || 'admin123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }

  console.log('\n=================================');
  console.log('Password Hash Generated');
  console.log('=================================');
  console.log(`Password: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log('\nAdd this to your seed.sql file:');
  console.log(`INSERT INTO users (username, password_hash) VALUES ('admin', '${hash}');`);
  console.log('=================================\n');
});
