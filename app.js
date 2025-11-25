// Simple sample data types:
// sample-ledger.json: [{ account_id, timestamp, type, points_delta, description }]
// sample-balances.json: [{ account_id, snapshot_balance }]

let ledgerEvents = [];
let balanceSnapshots = [];
let reconciledAccounts = [];

const toleranceInput = document.getElementById("tolerance");
const accountFilterInput = document.getElementById("account-filter");
const statusFilterSelect = document.getElementById("status-filter");
const reloadBtn = document.getElementById("reloadBtn");

const summaryBadgeEl = document.getElementById("summary-badge");
const summaryTextEl = document.getElementById("summary-text");
const accountsTbodyEl = document.getElementById("accounts-tbody");
const accountsCountEl = document.getElementById("accounts-count");

const detailAccountLabelEl = document.getElementById("detail-account-label");
const detailSummaryEl = document.getElementById("detail-summary");
const eventsTbodyEl = document.getElementById("events-tbody");
const rawOutputEl = document.getElementById("raw-output");

let activeAccountId = null;

function updateSummaryBadge(statusKey, text) {
  summaryBadgeEl.classList.remove(
    "summary-badge-idle",
    "summary-badge-ok",
    "summary-badge-warn",
    "summary-badge-fail"
  );

  let label = "";
  if (statusKey === "ok") {
    summaryBadgeEl.classList.add("summary-badge-ok");
    label = "All accounts in balance (within tolerance)";
  } else if (statusKey === "warn") {
    summaryBadgeEl.classList.add("summary-badge-warn");
    label = "Minor reconciliation drift";
  } else if (statusKey === "fail") {
    summaryBadgeEl.classList.add("summary-badge-fail");
    label = "Material ledger mismatches detected";
  } else {
    summaryBadgeEl.classList.add("summary-badge-idle");
    label = "Loading ledger…";
  }

  summaryBadgeEl.textContent = label;
  if (text) {
    summaryTextEl.textContent = text;
  }
}

function formatDiff(diff) {
  if (!isFinite(diff)) return "-";
  if (diff === 0) return "0";
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff}`;
}

function classifyDrift(diff, tolerance) {
  const absDiff = Math.abs(diff);
  if (absDiff <= tolerance) return "in-balance";
  if (absDiff <= tolerance * 10) return "minor-drift";
  return "material-mismatch";
}

function summarizeDriftCounts(accounts) {
  let inBalance = 0;
  let minor = 0;
  let material = 0;

  accounts.forEach((acc) => {
    if (acc.status === "in-balance") inBalance++;
    else if (acc.status === "minor-drift") minor++;
    else if (acc.status === "material-mismatch") material++;
  });

  return { inBalance, minor, material };
}

async function loadData() {
  try {
    // Show loading state in table while reloading
    accountsTbodyEl.innerHTML =
      '<tr><td colspan="5" class="empty-state">Loading…</td></tr>';
    accountsCountEl.textContent = "";
    updateSummaryBadge("idle", "Fetching sample ledger and balances from static JSON files…");

    const [ledgerRes, balancesRes] = await Promise.all([
      fetch("sample-ledger.json"),
      fetch("sample-balances.json")
    ]);

    if (!ledgerRes.ok || !balancesRes.ok) {
      throw new Error("Failed to load sample data.");
    }

    ledgerEvents = await ledgerRes.json();
    balanceSnapshots = await balancesRes.json();

    reconcile();
  } catch (err) {
    console.error(err);
    updateSummaryBadge(
      "fail",
      "Unable to load sample data. Check that JSON files are present in the repo."
    );
    accountsTbodyEl.innerHTML =
      '<tr><td colspan="5" class="empty-state">Failed to load sample data.</td></tr>';
  }
}

function reconcile() {
  const tolerance = parseInt(toleranceInput.value, 10);
  const safeTolerance = isNaN(tolerance) || tolerance < 0 ? 0 : tolerance;

  // Group events by account
  const eventsByAccount = ledgerEvents.reduce((acc, evt) => {
    const id = evt.account_id;
    if (!acc[id]) acc[id] = [];
    acc[id].push(evt);
    return acc;
  }, {});

  // Create snapshot map
  const snapshotMap = balanceSnapshots.reduce((acc, snap) => {
    acc[snap.account_id] = snap.snapshot_balance;
    return acc;
  }, {});

  const accountsSet = new Set([
    ...Object.keys(eventsByAccount),
    ...Object.keys(snapshotMap)
  ]);

  const accounts = Array.from(accountsSet).map((accountId) => {
    const events = (eventsByAccount[accountId] || []).slice();

    // Sort by timestamp ascending
    events.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return ta - tb;
    });

    let running = 0;
    const enrichedEvents = events.map((evt) => {
      const delta = Number(evt.points_delta) || 0;
      running += delta;
      return {
        ...evt,
        running_balance: running
      };
    });

    const computedBalance = running;
    const snapshotBalance = Number(snapshotMap[accountId] ?? 0);
    const diff = snapshotBalance - computedBalance;
    const status = classifyDrift(diff, safeTolerance);

    return {
      account_id: accountId,
      snapshot_balance: snapshotBalance,
      computed_balance: computedBalance,
      diff,
      status,
      events: enrichedEvents
    };
  });

  reconciledAccounts = accounts;
  renderAccountsTable();
  updateSummaryFromAccounts();
  clearDetailView();
}

function updateSummaryFromAccounts() {
  if (!reconciledAccounts.length) {
    updateSummaryBadge("idle", "No accounts found in sample data.");
    accountsCountEl.textContent = "";
    return;
  }

  const counts = summarizeDriftCounts(reconciledAccounts);
  const total = reconciledAccounts.length;

  let statusKey = "ok";
  if (counts.material > 0) statusKey = "fail";
  else if (counts.minor > 0) statusKey = "warn";

  const text =
    `${total} accounts checked — ` +
    `${counts.inBalance} in balance, ` +
    `${counts.minor} with minor drift, ` +
    `${counts.material} with material mismatches.`;

  accountsCountEl.textContent = text;
  updateSummaryBadge(statusKey, text);
}

function renderAccountsTable() {
  const filterText = accountFilterInput.value.trim().toLowerCase();
  const statusFilter = statusFilterSelect.value;

  const rows = reconciledAccounts.filter((acc) => {
    const matchesAccount =
      !filterText || acc.account_id.toLowerCase().includes(filterText);
    const matchesStatus =
      statusFilter === "all" || acc.status === statusFilter;
    return matchesAccount && matchesStatus;
  });

  if (!rows.length) {
    accountsTbodyEl.innerHTML =
      '<tr><td colspan="5" class="empty-state">No accounts match the current filters.</td></tr>';
    return;
  }

  const rowsHtml = rows
    .map((acc) => {
      const diff = acc.diff;
      const diffClass =
        diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "";
      const statusLabel =
        acc.status === "in-balance"
          ? "In balance"
          : acc.status === "minor-drift"
          ? "Minor drift"
          : "Material mismatch";
      const statusClass =
        acc.status === "in-balance"
          ? "status-in-balance"
          : acc.status === "minor-drift"
          ? "status-minor-drift"
          : "status-material-mismatch";

      const isActive = acc.account_id === activeAccountId;
      const activeClass = isActive ? " active-row" : "";

      return `
        <tr class="account-row${activeClass}" data-account-id="${acc.account_id}">
          <td>${acc.account_id}</td>
          <td>${acc.snapshot_balance}</td>
          <td>${acc.computed_balance}</td>
          <td class="${diffClass}">${formatDiff(diff)}</td>
          <td>
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </td>
        </tr>
      `;
    })
    .join("");

  accountsTbodyEl.innerHTML = rowsHtml;

  // Wire row clicks
  const rowEls = accountsTbodyEl.querySelectorAll(".account-row");
  rowEls.forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-account-id");
      selectAccount(id);
    });
  });
}

function clearDetailView() {
  activeAccountId = null;
  detailAccountLabelEl.textContent = "No account selected.";
  detailSummaryEl.textContent =
    "Click an account in the table to see its event history and running balance.";
  eventsTbodyEl.innerHTML =
    '<tr><td colspan="5" class="empty-state">No account selected.</td></tr>';
  rawOutputEl.textContent = "No account selected.";
}

function selectAccount(accountId) {
  const acc = reconciledAccounts.find((a) => a.account_id === accountId);
  if (!acc) {
    clearDetailView();
    return;
  }

  activeAccountId = accountId;

  // Highlight active row
  const rows = accountsTbodyEl.querySelectorAll(".account-row");
  rows.forEach((row) => {
    if (row.getAttribute("data-account-id") === accountId) {
      row.classList.add("active-row");
    } else {
      row.classList.remove("active-row");
    }
  });

  const statusLabel =
    acc.status === "in-balance"
      ? "in balance (within tolerance)"
      : acc.status === "minor-drift"
      ? "showing minor drift"
      : "showing a material mismatch";

  detailAccountLabelEl.textContent = `Account ${accountId} — ${statusLabel}.`;

  const diff = acc.diff;
  const direction =
    diff === 0
      ? "matches the event-level balance"
      : diff > 0
      ? "is higher than the event-level balance"
      : "is lower than the event-level balance";

  const absDiff = Math.abs(diff);

  const summaryText =
    diff === 0
      ? `Snapshot balance (${acc.snapshot_balance} points) matches the reconstructed balance from events (${acc.computed_balance} points).`
      : `Snapshot balance (${acc.snapshot_balance} points) ${direction} (${acc.computed_balance} points) by ${absDiff} points. This usually indicates a missing correction, backfill, or out-of-order event.`;

  detailSummaryEl.textContent = summaryText;

  renderEventsTable(acc);
  renderRawDetail(acc);
}

function renderEventsTable(acc) {
  if (!acc.events.length) {
    eventsTbodyEl.innerHTML =
      '<tr><td colspan="5" class="empty-state">No events found for this account.</td></tr>';
    return;
  }

  const rowsHtml = acc.events
    .map((evt) => {
      const delta = Number(evt.points_delta) || 0;
      const deltaSign = delta > 0 ? "+" : "";
      const deltaClass =
        delta > 0 ? "diff-positive" : delta < 0 ? "diff-negative" : "";
      const ts = evt.timestamp || "";
      const type = evt.type || "";
      const desc = evt.description || "";
      return `
        <tr>
          <td>${ts}</td>
          <td>${type}</td>
          <td class="${deltaClass}">${deltaSign}${delta}</td>
          <td>${evt.running_balance}</td>
          <td>${desc}</td>
        </tr>
      `;
    })
    .join("");

  eventsTbodyEl.innerHTML = rowsHtml;
}

function renderRawDetail(acc) {
  const cleaned = {
    account_id: acc.account_id,
    snapshot_balance: acc.snapshot_balance,
    computed_balance: acc.computed_balance,
    diff: acc.diff,
    status: acc.status,
    events: acc.events.map((e) => ({
      timestamp: e.timestamp,
      type: e.type,
      points_delta: e.points_delta,
      running_balance: e.running_balance,
      description: e.description
    }))
  };

  rawOutputEl.textContent = JSON.stringify(cleaned, null, 2);
}

// Event wiring
toleranceInput.addEventListener("change", () => {
  reconcile();
});

accountFilterInput.addEventListener("input", () => {
  renderAccountsTable();
});

statusFilterSelect.addEventListener("change", () => {
  renderAccountsTable();
});

// 🔁 Reload button now fully resets the scenario
reloadBtn.addEventListener("click", () => {
  // Reset inputs to default state
  toleranceInput.value = "5";
  accountFilterInput.value = "";
  statusFilterSelect.value = "all";

  // Clear detail + active selection
  clearDetailView();

  // Reload sample data and re-run reconciliation
  loadData();
});

// Init
loadData();
