// Script to generate admin user password hash
// This is called by setup-d1.sh

const password = 'admin123';

// Convert string to Uint8Array
function stringToUint8Array(str) {
  return new TextEncoder().encode(str);
}

// Convert ArrayBuffer to hex string
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
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
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  // Format: iterations$salt$hash
  const saltHex = bufferToHex(salt);
  const hashHex = bufferToHex(derivedBits);

  return `${iterations}$${saltHex}$${hashHex}`;
}

// Generate hash and output SQL
hashPassword(password).then(hash => {
  console.log(`-- Admin user for personal blog`);
  console.log(`-- Username: admin`);
  console.log(`-- Password: ${password}`);
  console.log(`INSERT OR IGNORE INTO users (id, username, password_hash)`);
  console.log(`VALUES (1, 'admin', '${hash}');`);
}).catch(err => {
  console.error('Error generating hash:', err);
  process.exit(1);
});
