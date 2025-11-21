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

# Create admin user with password hash
echo "Creating admin user..."
node setup-admin.js > admin-user.sql
wrangler d1 execute blog-db --file=./admin-user.sql
rm admin-user.sql
echo "✅ Admin user created"
echo ""

# Run seed data (blog posts)
echo "Inserting seed data..."
wrangler d1 execute blog-db --file=./seed.sql
echo "✅ Seed data inserted"
echo ""

echo "==================================="
echo "✅ Setup Complete!"
echo "==================================="
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "To change the password, run:"
echo "  node generate-password.js your-new-password"
echo ""
echo "Next steps:"
echo "  1. Run 'npm install' to install dependencies"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Visit http://localhost:4321/admin/login to login"
echo ""
