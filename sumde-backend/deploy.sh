#!/bin/bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"

REPO_DIR="$HOME/domains/sumdebetta.com/.repo"
FRONTEND_DIR="$HOME/domains/sumdebetta.com/.frontend"
NODEJS_DIR="$HOME/domains/sumdebetta.com/nodejs"
PUBLIC_DIR="$HOME/domains/sumdebetta.com/public_html"

# Pull backend (main branch)
cd "$REPO_DIR" && git pull origin main

# Pull frontend build (deploy-frontend branch)
cd "$FRONTEND_DIR" && git fetch origin deploy-frontend && git reset --hard origin/deploy-frontend

# Sync backend ke nodejs/
rsync -r --exclude='node_modules' --exclude='dev.db' \
  "$REPO_DIR/sumde-backend/" \
  "$NODEJS_DIR/"

# Install dependencies & migrate DB
cd "$NODEJS_DIR"
npm install --omit=dev
npx prisma generate
npx prisma db push

# Sync frontend ke public_html/
rsync -r --delete --exclude='.git' \
  "$FRONTEND_DIR/" \
  "$PUBLIC_DIR/"

# Restart Node.js app (Hostinger passenger style)
mkdir -p "$NODEJS_DIR/tmp"
touch "$NODEJS_DIR/tmp/restart.txt"
