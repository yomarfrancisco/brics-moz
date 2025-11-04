#!/bin/bash
# TRON diagnostic curl scripts
# Usage: ./scripts/curl/tron-diag.sh [base_url]
# Example: ./scripts/curl/tron-diag.sh https://brics-moz.vercel.app

BASE_URL="${1:-https://brics-moz.vercel.app}"

echo "=== TRON Health Check ==="
curl -s "${BASE_URL}/api/diag/tron-health" | jq '.'

echo ""
echo "=== TRON Round-trip Diagnostic ==="
curl -s "${BASE_URL}/api/diag/tron-roundtrip" | jq '.'

echo ""
echo "=== TRON Ensure Address (requires auth) ==="
echo "To test ensure-address, you need a valid Firebase ID token."
echo "Example:"
echo "  TOKEN='your-firebase-id-token'"
echo "  curl -X POST \"${BASE_URL}/api/wallet/tron/ensure-address\" \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"

