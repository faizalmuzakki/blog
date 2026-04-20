#!/bin/bash

# Setup script for Cloudflare D1 database

echo "==================================="
echo "Blog - D1 Database Setup"
echo "==================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed."
    echo "Please install it with: npm install -g wrangler"
    exit 1
fi

echo "✅ Wrangler is installed"
echo ""

# Login check
echo "Checking Wrangler authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ You are not logged in to Cloudflare."
    echo "Please run: wrangler login"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Create D1 database
echo "Creating D1 database 'blog-db'..."
DATABASE_OUTPUT=$(wrangler d1 create blog-db 2>&1)

if echo "$DATABASE_OUTPUT" | grep -q "already exists"; then
    echo "ℹ️  Database already exists"
    # Extract database ID from list command
    DATABASE_ID=$(wrangler d1 list | grep "blog-db" | awk '{print $2}')
else
    # Extract database ID from create output
    DATABASE_ID=$(echo "$DATABASE_OUTPUT" | grep "database_id" | sed 's/.*database_id = "\(.*\)".*/\1/')
    echo "✅ Database created"
fi

echo "Database ID: $DATABASE_ID"
echo ""

# Update wrangler.toml with the database ID
echo "Updating wrangler.toml with database ID..."
sed -i "s/database_id = \"your-database-id\"/database_id = \"$DATABASE_ID\"/" wrangler.toml
echo "✅ wrangler.toml updated"
echo ""

# Run schema
echo "Creating database tables..."
wrangler d1 execute blog-db --file=./schema.sql
echo "✅ Tables created"
echo ""

# Run seed data (blog posts)
echo "Inserting seed data..."
wrangler d1 execute blog-db --file=./seed.sql
echo "✅ Seed data inserted"
echo ""

# Generate a strong random admin password on first run
echo "Creating admin user with generated password..."
ADMIN_PASSWORD=$(openssl rand -base64 18)
ADMIN_HASH=$(node generate-password.js --hash-only "$ADMIN_PASSWORD")

# Write a one-shot SQL file to avoid shell quoting issues with $ in the hash
cat > /tmp/insert-admin.sql <<SQL
INSERT INTO users (username, password_hash, role) VALUES ('admin', '${ADMIN_HASH}', 'admin');
SQL
wrangler d1 execute blog-db --file=/tmp/insert-admin.sql
rm /tmp/insert-admin.sql
echo "✅ Admin user created"
echo ""

echo "==================================="
echo "✅ Setup Complete!"
echo "==================================="
echo ""
echo "================================================================"
echo "⚠️  Save this password now — it will not be shown again."
echo ""
echo "   Username: admin"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "================================================================"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' to install dependencies"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Visit http://localhost:4321/admin/login to login"
echo ""
