# BuildFlow 1 — Dimixkoj Enterprise

This repository is the independent BuildFlow 1 application codebase, separated from the ConFlow 1 repository. It begins from the shared offline-first desktop foundation so the two applications can be developed, built, tested and released independently.

## Identity and data separation

- Product key: `buildflow1`
- Product name: BuildFlow 1
- Company: Dimixkoj Enterprise
- Shared workforce backend: Dimixkoj Enterprise Supabase project
- BuildFlow records are scoped with `app_key = 'buildflow1'`; ConFlow records remain scoped to `app_key = 'conflow1'`.
- Local app data is stored in a separate application-data folder.

## Current transfer status

This is the initial independent repository transfer of the current desktop foundation. The renderer still contains shared construction-workspace modules inherited from the source foundation. The dedicated BuildFlow licence-owner, buyer portal, licence issuance, activation, renewal and central licence register screens are not yet complete and must be implemented here as BuildFlow-specific modules before a production release.

## Shared Supabase connection

The client uses the public publishable key only. It supports email sign-in/sign-up, owner or active app-membership lookup, and an initial app-scoped project-header upload. Supabase RLS remains the authority for access. No service-role key is included.

The first owner account must be registered with the company owner email configured in the shared workspace. Other users need an active BuildFlow membership.

## Build

Requires Node.js 22.

```bash
npm install
npm run start:buildflow
npm run dist:buildflow
npm test
```

## Not yet production-complete

- BuildFlow-specific licence management and buyer screens.
- Licence key issuance, one-time activation, device binding, expiry and renewal.
- Payment provider verification.
- Full workforce records, attendance, chat and report synchronisation.
- Bidirectional offline sync and conflict review.
- APK packaging, signing, Windows signing and release QA.
