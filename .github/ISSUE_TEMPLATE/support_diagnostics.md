---
name: Support diagnostics
about: Share a redacted diagnostics packet for troubleshooting
title: "[Diagnostics]: "
labels: support, diagnostics
assignees: ""
---

## What should we help diagnose?

Briefly describe the symptom, workflow, and urgency.

## Required packet

- Redacted Admin Diagnostics attached: yes/no
- Generated at:
- API request ID, if relevant:
- Backend Health status:
- Hosted deploy rehearsal command result:

## Deployment context

- App host:
- API host:
- Storage/auth mode:
- Supabase migrations applied: 001, 002, 003, unknown
- SMTP or webhook reset delivery:
- Server backups configured: yes/no

## Reproduction

1.
2.
3.

## Redaction checklist

- No raw API tokens
- No Supabase service-role key
- No SMTP credentials
- No payment keys
- No webhook secrets
- No private customer data
