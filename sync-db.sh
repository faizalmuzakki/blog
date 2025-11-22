#!/bin/bash

# Database sync utility for Cloudflare D1
# Usage: ./sync-db.sh [pull|push]

set -e

DB_NAME="blog-db"
BACKUP_FILE="db-backup.sql"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_usage() {
    echo "Usage: ./sync-db.sh [pull|push]"
    echo ""
    echo "Commands:"
    echo "  pull    Sync remote database to local (download from production)"
    echo "  push    Sync local database to remote (upload to production)"
    echo ""
    echo "Examples:"
    echo "  ./sync-db.sh pull   # Get latest data from production"
    echo "  ./sync-db.sh push   # Upload local changes to production"
}

pull_remote() {
    echo -e "${BLUE}📥 Pulling remote database to local...${NC}"
    echo ""

    # Export from remote
    echo -e "${YELLOW}Step 1/3: Exporting from remote...${NC}"
    wrangler d1 export $DB_NAME --remote --output=$BACKUP_FILE

    # Drop local tables
    echo -e "${YELLOW}Step 2/3: Clearing local database...${NC}"
    wrangler d1 execute $DB_NAME --command "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS users;"

    # Import to local
    echo -e "${YELLOW}Step 3/3: Importing to local...${NC}"
    wrangler d1 execute $DB_NAME --file=$BACKUP_FILE

    # Clean up
    rm $BACKUP_FILE

    echo ""
    echo -e "${GREEN}✅ Successfully synced remote → local${NC}"
    echo -e "${GREEN}You can now run 'npm run dev' with production data${NC}"
}

push_local() {
    echo -e "${BLUE}📤 Pushing local database to remote...${NC}"
    echo ""

    # Warning
    echo -e "${RED}⚠️  WARNING: This will overwrite your production database!${NC}"
    read -p "Are you sure you want to continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi

    # Export from local
    echo -e "${YELLOW}Step 1/3: Exporting from local...${NC}"
    wrangler d1 export $DB_NAME --output=$BACKUP_FILE

    # Drop remote tables
    echo -e "${YELLOW}Step 2/3: Clearing remote database...${NC}"
    wrangler d1 execute $DB_NAME --command "DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS posts; DROP TABLE IF EXISTS users;" --remote

    # Import to remote
    echo -e "${YELLOW}Step 3/3: Importing to remote...${NC}"
    wrangler d1 execute $DB_NAME --file=$BACKUP_FILE --remote

    # Clean up
    rm $BACKUP_FILE

    echo ""
    echo -e "${GREEN}✅ Successfully synced local → remote${NC}"
    echo -e "${GREEN}Your production database has been updated${NC}"
}

# Main script
if [ $# -eq 0 ]; then
    print_usage
    exit 1
fi

case "$1" in
    pull)
        pull_remote
        ;;
    push)
        push_local
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$1'${NC}"
        echo ""
        print_usage
        exit 1
        ;;
esac
