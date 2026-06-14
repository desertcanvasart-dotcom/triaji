# Lab Chain Integration — Post-Contract Activation Checklist

## Pre-requisites
- [ ] Business contract signed with lab chain
- [ ] API documentation received from chain

## Activation Steps

### Step 1: API Credentials
Set environment variables:
- `{CHAIN}_BASE_URL` — production API base URL
- `{CHAIN}_API_KEY` — API key from chain
- `{CHAIN}_SECRET` — HMAC signing secret
- `{CHAIN}_WEBHOOK_SECRET` — webhook verification secret

### Step 2: Test API Connection
POST /api/admin/chains/{code}/test
Verify: response shows success with test order ID.

### Step 3: Import Branch Locations
Receive branch list from chain (CSV or API).
POST /api/admin/chains/{code}/import-branches
Verify: branches appear in /chains admin page.

### Step 4: Import Test Code Mapping
Receive test catalog from chain.
Map each chain test code to Triaji lab_test_catalog.code.
POST /api/admin/chains/{code}/import-tests
Verify: test mappings appear in admin.

### Step 5: Configure Webhook URL
Provide chain with Triaji webhook URL:
POST https://api.triaji.com/api/webhooks/lab-chain/{code}

### Step 6: Set has_api = true
Update lab_chains record: has_api = true, api_contract_signed = true, api_live_date = today.

### Step 7: Monitor First 10 Orders
Watch the first 10 API-routed orders manually.
Verify: orders submitted, results received, notifications sent.

### Step 8: Full Rollout
Remove monitoring. Chain is fully active.
