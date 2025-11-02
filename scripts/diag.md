# PayFast Diagnostic Commands

Read-only diagnostic commands for troubleshooting PayFast ITN flow.

## Setup

```bash
export UPSTASH_REDIS_REST_URL="https://notable-cowbird-22903.upstash.io"
export UPSTASH_REDIS_REST_TOKEN="All3AAIgcDL4-8KmMrIqM9nn72YDF7c_b66x60ZH_JT-wetqsi3_0g"
export APP_BASE="https://brics-moz.vercel.app"
```

## Recent Diagnostic Logs

View the last 20 diagnostic log entries:

```bash
curl -s -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/scan/0?match=payfast:log:*&count=20" | jq
```

## Check Payment Record for Specific REF

Replace `<REF>` with the actual payment reference:

```bash
REF="<paste-latest-ref>"

# Check HSET json field (primary storage method)
curl -s -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/hget/payfast:$REF/json" | jq -r '.result' | jq

# Check GET (legacy method, should return null if using HSET)
curl -s -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/get/payfast:$REF" | jq -r '.result' | jq
```

## Public Status API

Compare with what the frontend sees:

```bash
curl -s "$APP_BASE/api/payfast/status?ref=$REF" | jq
```

## Expected Output

- **HSET json field**: Should contain `{"status": "COMPLETE", "amount_gross": "...", ...}`
- **GET**: Should return `null` (we use HSET json, not SET)
- **Public API**: Should match the HSET json content, returning `{"ref": "...", "status": "COMPLETE", "amount": "...", ...}`

## Common Issues

1. **Storage mismatch**: If GET returns data but HSET json doesn't, there's a storage format mismatch
2. **Status stuck on PENDING**: Check diagnostic logs for `stage: "persisted"` to confirm ITN was accepted and stored
3. **Status lookup failing**: Check logs for `stage: "status_lookup"` to see if the API can find the record
