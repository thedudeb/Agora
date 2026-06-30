# Agora Template Marketplace

This folder holds shareable Agora project-template packs. Each template can be imported from the Templates page by pasting the JSON into the marketplace import box.

## Format

Use either a single template object or an export wrapper:

```json
{
  "type": "agora.project-template",
  "exportVersion": 1,
  "template": {
    "id": "community-example",
    "name": "Community Example",
    "category": "Community",
    "description": "A reusable project workflow.",
    "owner": "mara",
    "creatorName": "Community Creator",
    "durationDays": 14,
    "priceCents": 0,
    "currency": "USD",
    "payout": {
      "mode": "charity",
      "recipientName": "Example Charity",
      "walletAddress": "0xExampleWallet",
      "chain": "Base",
      "charityName": "Example Charity",
      "donationPercent": 100,
      "note": "Optional payout instructions for future payment adapters."
    },
    "tasks": [],
    "milestones": [],
    "docs": [],
    "intakeForm": {
      "title": "Community Example Intake",
      "assignee": "mara",
      "description": "Collect requests for this workflow."
    }
  }
}
```

Task `key` values are used by `blockedBy` and milestone `taskKeys`, so keep them short, stable, and unique.

`priceCents`, `currency`, `creatorName`, and `payout` are optional. Current community templates should stay free by default. Premium templates with `priceCents > 0` are gated by local entitlements in the prototype, and server-issued entitlements can replace test grants once a payment adapter exists.

The `payout` object is metadata only until a server payment adapter verifies the destination. Use it to describe where fees should go, including creator wallets, charity wallets, or creator/charity splits.
