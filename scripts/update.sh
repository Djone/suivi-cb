#!/bin/bash

# Suivi CB NAS update script.
# Usage:
#   ./scripts/update.sh              -> full update (git pull + rebuild)
#   ./scripts/update.sh backend      -> update backend only
#   ./scripts/update.sh frontend     -> update frontend only
#   ./scripts/update.sh db           -> backup + service restart only

set -e

echo "=== Starting Suivi CB update ==="

# Resolve project root from script location so the script can run from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

DEFAULT_APP_DIR="/volume1/docker/suivi-cb"
APP_DIR="${APP_DIR:-$PROJECT_ROOT}"
if [ ! -f "$APP_DIR/docker-compose.yml" ]; then
  APP_DIR="$DEFAULT_APP_DIR"
fi

BACKUP_DIR="$APP_DIR/backups"
DATE="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/database_before_update_$DATE.db"
GIT_BRANCH="${GIT_BRANCH:-master}"
TARGET_SERVICE="all"
MODE="full"

if [ ! -d "$APP_DIR" ]; then
  echo "ERROR: Application directory not found: $APP_DIR"
  exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
  echo "ERROR: docker-compose is not installed or not in PATH."
  exit 1
fi

cd "$APP_DIR"

if [ "$#" -gt 0 ]; then
  case "$1" in
    backend|frontend)
      TARGET_SERVICE="$1"
      echo "-> Targeted update for service: $TARGET_SERVICE"
      ;;
    db)
      MODE="db"
      echo "-> DB mode: backup + restart only"
      ;;
    *)
      echo "WARN: Unknown argument '$1'. Running full update."
      ;;
  esac
fi

if [ "$MODE" = "db" ]; then
  echo "[1/2] Creating database backup..."
  mkdir -p "$BACKUP_DIR"
  cp "$APP_DIR/data/database.db" "$BACKUP_FILE"
  echo "-> Backup created: $BACKUP_FILE"

  echo "[2/2] Restarting containers..."
  sudo docker-compose restart
  echo "=== DB mode complete ==="
  exit 0
fi

echo "Running full update mode (git pull + rebuild)..."
OLD_COMMIT="$(git rev-parse HEAD)"

rollback() {
  local step="$1"
  echo "ERROR during '$step'. Starting rollback..."

  echo "1) Restoring previous code version: $OLD_COMMIT"
  git checkout "$OLD_COMMIT" --force

  echo "2) Restoring database backup if available"
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" "$APP_DIR/data/database.db"
  else
    echo "WARN: Backup file not found. Database not restored."
  fi

  echo "3) Recreating containers from previous version"
  sudo docker-compose up -d --build --force-recreate

  echo "Rollback finished."
  exit 1
}

echo "[1/7] Creating database backup..."
mkdir -p "$BACKUP_DIR"
cp "$APP_DIR/data/database.db" "$BACKUP_FILE" || rollback "backup"
echo "-> Backup created: $BACKUP_FILE"

echo "[2/7] Stopping docker services..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose down || rollback "docker stop"
else
  sudo docker-compose stop "$TARGET_SERVICE" || rollback "docker stop $TARGET_SERVICE"
fi

echo "[3/7] Pulling latest code from git..."
git pull origin "$GIT_BRANCH" || rollback "git pull"

echo "[4/7] Building docker images..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose build --no-cache || rollback "docker build"
else
  sudo docker-compose build --no-cache "$TARGET_SERVICE" || rollback "docker build $TARGET_SERVICE"
fi

echo "[5/7] Starting containers..."
if [ "$TARGET_SERVICE" = "all" ]; then
  sudo docker-compose up -d || rollback "docker start"
else
  sudo docker-compose up -d --no-deps --build --force-recreate "$TARGET_SERVICE" || rollback "docker start $TARGET_SERVICE"
fi

echo "[6/7] Health check (wait 15s)..."
sleep 15
if ! curl -fsS http://localhost:3001/api/accounts/active >/dev/null; then
  rollback "api health check"
fi
echo "-> API is responding."

echo "[7/7] Cleaning old docker images..."
sudo docker image prune -f

echo "=== Update completed successfully ==="
echo "Current version: $(git describe --tags --always --dirty)"
