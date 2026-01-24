#!/bin/bash

# iOS + Android OTA Update Script (Production)
#
# This script publishes an OTA update for both iOS and Android to the
# production branch. It ensures the update matches the current app.json
# version and that the production build channel matches the branch.
#
# Usage:
#   ./scripts/publish-update-all.sh "Your update message"
#   ./scripts/publish-update-all.sh -m "Your update message"
#   ./scripts/publish-update-all.sh --yes "Your update message"

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$MOBILE_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}❌ node is not installed or not in PATH${NC}"
  exit 1
fi

if ! command -v eas >/dev/null 2>&1; then
  echo -e "${RED}❌ eas CLI is not installed or not in PATH${NC}"
  echo -e "${YELLOW}   Install: npm install -g eas-cli${NC}"
  exit 1
fi

if [ ! -f "./app.json" ] || [ ! -f "./eas.json" ]; then
  echo -e "${RED}❌ app.json or eas.json not found. Run from mobile/ directory.${NC}"
  exit 1
fi

APP_VERSION=$(node -e "const app=require('./app.json'); console.log(app.expo.version || '');")
PROD_CHANNEL=$(node -e "const eas=require('./eas.json'); console.log(eas.build?.production?.channel || '');")
UPDATES_URL=$(node -e "const app=require('./app.json'); console.log(app.expo?.updates?.url || '');")
BRANCH="production"

if [ -z "$APP_VERSION" ]; then
  echo -e "${RED}❌ app.json expo.version is empty${NC}"
  exit 1
fi

if [ -z "$UPDATES_URL" ]; then
  echo -e "${RED}❌ app.json expo.updates.url is empty${NC}"
  echo -e "${YELLOW}   EAS Update requires updates.url to be set.${NC}"
  exit 1
fi

if [ "$PROD_CHANNEL" != "$BRANCH" ]; then
  echo -e "${RED}❌ eas.json production.channel does not match branch '${BRANCH}'${NC}"
  echo -e "${YELLOW}   Current value: '${PROD_CHANNEL}'${NC}"
  echo -e "${YELLOW}   Please fix eas.json before publishing.${NC}"
  exit 1
fi

UPDATE_MESSAGE=""
AUTO_YES="false"

while [ "${1:-}" != "" ]; do
  case "$1" in
    -m|--message)
      shift
      UPDATE_MESSAGE="${1:-}"
      ;;
    --yes)
      AUTO_YES="true"
      ;;
    *)
      if [ -z "$UPDATE_MESSAGE" ]; then
        UPDATE_MESSAGE="$1"
      else
        UPDATE_MESSAGE="${UPDATE_MESSAGE} $1"
      fi
      ;;
  esac
  shift || true
done

if [ -z "$UPDATE_MESSAGE" ]; then
  UPDATE_MESSAGE="Hotfix v${APP_VERSION}"
fi

echo -e "${GREEN}🚀 Publishing iOS + Android OTA update${NC}"
echo -e "${YELLOW}   Branch: ${BRANCH}${NC}"
echo -e "${YELLOW}   Channel: ${PROD_CHANNEL}${NC}"
echo -e "${YELLOW}   Runtime Version: ${APP_VERSION}${NC}"
echo -e "${YELLOW}   Updates URL: ${UPDATES_URL}${NC}"
echo -e "${YELLOW}   Message: ${UPDATE_MESSAGE}${NC}"
echo ""

if [ "$AUTO_YES" != "true" ]; then
  read -r -p "Continue? (y/N) " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 1
  fi
fi

eas update --branch "${BRANCH}" --platform all --message "${UPDATE_MESSAGE}"

echo ""
echo -e "${GREEN}✅ iOS + Android OTA update published${NC}"
echo -e "${YELLOW}🔍 Verify:${NC} eas update:list --branch ${BRANCH} --limit 5"
