// Script to generate password hash using Web Crypto API (PBKDF2)
// Usage: node generate-password.js <password>

const password = process.argv[2] || 'admin123';

// Convert string to Uint8Array
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Hash a password using PBKDF2
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  // Format: iterations$salt$hash
  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return `${iterations}$${saltHex}$${hashHex}`;
}

// Run the hash
hashPassword(password)
  .then((hash) => {
    console.log('\n=================================');
    console.log('Password Hash Generated');
    console.log('=================================');
    console.log(`Password: ${password}`);
    console.log(`Hash: ${hash}`);
    console.log('\nAdd this to your seed.sql file:');
    console.log(`INSERT INTO users (username, password_hash) VALUES ('admin', '${hash}');`);
    console.log('=================================\n');
  })
  .catch((err) => {
    console.error('Error generating hash:', err);
    process.exit(1);
  });
