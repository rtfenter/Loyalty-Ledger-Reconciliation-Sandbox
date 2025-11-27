# Loyalty Ledger Reconciliation Sandbox  
[![Live Demo](https://img.shields.io/badge/Live%20Demo-000?style=for-the-badge)](https://rtfenter.github.io/Loyalty-Ledger-Reconciliation-Sandbox/)

### A small sandbox to reconcile event-level activity against account balances and surface loyalty ledger drift.

This project is part of my **Loyalty Systems Series**, exploring how loyalty systems behave beneath the UI layer — from event flow to FX reconciliation to partner tiering.

The goal of this sandbox is to make ledger reconciliation legible:

- How do earn / redeem / expire / correct events roll up into an account balance?  
- Where do balances drift away from event-level truth?  
- How can a product or data team quickly see which accounts are “out of balance” and by how much?  

Instead of treating the ledger as a black box, this prototype shows how event streams and balance snapshots can be compared, audited, and explained.

---

## Features (MVP)

The prototype includes:

- A **fake loyalty ledger** loaded from static files:
  - `sample-ledger.json` — event-level records (earn, redeem, expire, correct)
  - `sample-balances.json` — account-level balance snapshots  
- A lightweight reconciliation engine that:
  - Aggregates event deltas per account  
  - Compares computed balances vs stored balances  
  - Flags any account where the difference exceeds a small tolerance  
- A **summary view**:
  - Total accounts checked  
  - Accounts in balance  
  - Accounts out of balance  
  - Largest positive and negative drifts  
- An **account drill-down view**:
  - Event timeline for a selected account  
  - Running balance based on events  
  - Snapshot balance and “out of balance by X points” indicator  
- A simple “reconciliation story”:
  - Plain-language explanation of where the mismatch likely comes from (e.g., missing correction, double-posted event, stale snapshot)

All logic runs client-side in JavaScript over static JSON, but represents the kind of reconciliation work that would normally live in backend services or data pipelines.

---

## Demo Screenshot

<img width="2804" height="1514" alt="Screenshot 2025-11-25 at 11-28-35 Loyalty Ledger Reconciliation Sandbox" src="https://github.com/user-attachments/assets/35e023f4-7761-479d-a3bf-f852648e2ea9" />

---

## Ledger Reconciliation Flow

~~~
    [Event-Level Ledger + Balance Snapshots]
                    |
                    v
            Event Aggregation Layer
      (sum points deltas per account & type)
                    |
                    v
             Balance Reconstruction
       (computed_balance = Σ event_deltas)
                    |
                    v
         Snapshot Comparison & Tolerance
   (difference = snapshot_balance - computed)
                    |
                    v
         Drift Detection & Classification
   (in balance, minor drift, material mismatch)
                    |
                    v
        Account Drill-Down & Explanation
 (timeline + running balance + mismatch reason)
~~~

---

## Purpose

In real loyalty systems, reconciliation is where:

- Finance cares about **liability accuracy**  
- Data teams care about **event correctness**  
- Product teams care about **member trust**  

But it’s easy for drift to creep in:

- Backfills and corrections that never reach the snapshot  
- Out-of-order events  
- Partial failures in pipelines  
- Manual adjustments that aren’t reflected in the ledger  
- Separate systems writing to the same account state  

Over time, this creates small but compounding mismatches between:

- “What the events say”  
- “What the balance shows”  
- “What the member sees in the UI”  

This tool provides a small, understandable way to:

- Load a toy ledger and balance file  
- Reconstruct balances from events  
- See which accounts are out of alignment and by how much  
- Drill down into a single account to understand the path from events → balance

---

## How This Maps to Real Loyalty Systems

Even though it's minimal, each component corresponds to real architecture:

### Event-Level Ledger  
Production systems store event-level transactions:
- Earns (positive points)  
- Redeems (negative points)  
- Expiry events  
- Manual and system corrections  

These usually live in an append-only ledger or transaction table.

### Balance Snapshots  
To serve member UIs and downstream systems efficiently, programs store pre-computed balances:
- Often per account, per currency, per point type  
- Updated via batch jobs or streaming processors  

When these snapshots and the event ledger diverge, trust erodes quickly.

### Reconciliation Engine  
Backend jobs or data pipelines regularly:
- Rebuild balances from events  
- Compare them against stored balances  
- Emit discrepancies to a queue or reconciliation dashboard  

This prototype simulates that logic in a small, visible way.

### Drift Classification  
Not all drift is equal:

- Pennies or 1–2 points might be tolerable rounding noise  
- Large gaps often indicate missing events, duplicate writes, or failed corrections  

The sandbox surfaces drift levels so teams can decide what warrants action.

### Account Drill-Down  
When a specific account is out of balance, teams need to see:

- The full event history  
- How each event affects the running balance  
- Where the story stops lining up with the snapshot  

This prototype focuses on that narrative: making the path from “raw events” to “balance shown in the app” explorable.

This tool is a legible micro-version of how real loyalty systems reconcile truth between event streams and balances.

---

## Part of the Loyalty Systems Series

Main repo:  
https://github.com/rtfenter/Loyalty-Systems-Series

---

## Status  

MVP is active and implemented.  
Frontend implementation in progress — this sandbox will stay intentionally small and transparent, focused on reconciliation concepts, not on replicating full enterprise ledger infrastructure.

---

## Local Use

No installation required.  
Once implemented, to run the sandbox locally:

1. Clone the repo  
2. Open `index.html` in your browser  

Everything will run client-side using static JSON and browser-based aggregation.
