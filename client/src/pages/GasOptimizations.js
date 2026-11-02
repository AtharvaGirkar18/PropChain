import React, { useState } from "react";

// ─── Real before/after data from LandRegistry.sol & PropertyDispute.sol ───────
const OPT_DATA = [
  {
    id: 1,
    title: "calldata vs memory for String Arguments",
    tag: "OPT 1",
    contract: "LandRegistry.sol + PropertyDispute.sol",
    targetFn: "registerProperty(), raiseDispute(), resolveDispute()",
    principle:
      "External functions that only READ string/array arguments should declare them as `calldata`. Using `memory` forces the EVM to ABI-decode and copy the calldata bytes into a fresh memory region. `calldata` reads directly from the transaction input — zero copy cost.",
    remixTest:
      "1. Deploy Opt1_Before and Opt1_After from GasOptimizationShowcase.sol\n2. Call registerProperty(\"Mumbai\", \"Qm...hash\", 500, 1000000) on both\n3. Compare 'execution cost' in the Remix console — After is ~350 gas cheaper",
    before: {
      label: "BEFORE — memory (copies string into EVM memory)",
      code: `// LandRegistry.sol — registerProperty() BEFORE
function registerProperty(
    string memory _location,       // ← ABI-decode copy ~200 gas
    uint _area,
    uint _price,
    string memory _documentHash   // ← ABI-decode copy ~200 gas
) public {
    require(_area > 0, "Property area must be greater than 0");
    require(_price > 0, "Property price must be greater than 0");
    require(bytes(_location).length > 0, "Location cannot be empty");
    require(bytes(_documentHash).length > 0, "Document hash cannot be empty");
    require(!documentHashExists[_documentHash], "...");
    // ...
}`,
      gasNote: "~400 gas copy overhead per call (2 string args)",
      gasValue: 400,
    },
    after: {
      label: "AFTER — calldata (reads directly, no copy)",
      code: `// LandRegistry.sol — registerProperty() AFTER
function registerProperty(
    string calldata _location,     // ← zero-copy, reads from tx input
    uint _area,
    uint _price,
    string calldata _documentHash  // ← zero-copy, reads from tx input
) public {
    if (_area == 0) revert InvalidArea();
    if (_price == 0) revert InvalidPrice();
    if (bytes(_location).length == 0) revert EmptyLocation();
    if (bytes(_documentHash).length == 0) revert EmptyDocumentHash();
    if (documentHashExists[_documentHash]) revert DuplicateDocument();
    // ...
}`,
      gasNote: "~0 gas copy overhead — reads calldata directly",
      gasValue: 0,
    },
    saving: 350,
    savingNote: "~350 gas saved per call (2 string args, typical lengths)",
    color: "#6366f1",
  },
  {
    id: 2,
    title: "Cache Storage Pointer to Avoid Repeated Slot Lookups",
    tag: "OPT 2",
    contract: "PropertyDispute.sol",
    targetFn: "resolveDispute()",
    principle:
      "Every `mapping[key].field` access recomputes the storage slot hash (keccak256(key, baseSlot)) and issues an SLOAD. Assigning the mapping entry to a `storage` pointer computes the slot hash once — all subsequent field accesses through the pointer are cheap.",
    remixTest:
      "1. Deploy Opt2_Before and Opt2_After from GasOptimizationShowcase.sol\n2. Call seed(1, 99) on both to create dispute #1\n3. Call resolveDispute(1, 'Settled') on both\n4. Compare 'execution cost' — After is ~120 gas cheaper",
    before: {
      label: "BEFORE — repeated mapping[key] access (5 slot lookups)",
      code: `// PropertyDispute.sol — resolveDispute() BEFORE
function resolveDispute(uint _disputeId, string memory _resolution) public {
    require(disputeExists[_disputeId], "Dispute does not exist");
    require(!disputes[_disputeId].resolved, "Dispute already resolved"); // slot calc #1
    
    uint propertyId = disputes[_disputeId].propertyId;    // slot calc #2
    
    disputes[_disputeId].resolved   = true;               // slot calc #3
    disputes[_disputeId].resolvedAt = block.timestamp;    // slot calc #4
    disputes[_disputeId].resolution = _resolution;        // slot calc #5
    
    // each access = keccak256(key, slot) + SLOAD/SSTORE
}`,
      gasNote: "~5 separate slot hash computations per call",
      gasValue: 5,
    },
    after: {
      label: "AFTER — storage pointer (slot computed once)",
      code: `// PropertyDispute.sol — resolveDispute() AFTER
function resolveDispute(uint _disputeId, string calldata _resolution) public {
    if (!disputeExists[_disputeId]) revert DisputeDoesNotExist(_disputeId);
    
    // Slot hash computed ONCE — all field accesses below use this pointer
    Dispute storage d = disputes[_disputeId];              // 1 slot calc
    
    if (d.resolved) revert DisputeAlreadyResolved(_disputeId);
    uint propertyId = d.propertyId;   // cheap — pointer already resolved
    d.resolved   = true;              // cheap — pointer already resolved
    d.resolvedAt = block.timestamp;   // cheap — pointer already resolved
    d.resolution = _resolution;       // cheap — pointer already resolved
}`,
      gasNote: "~1 slot hash computation (saves 4 repeated lookups)",
      gasValue: 1,
    },
    saving: 120,
    savingNote: "~120 gas saved per resolveDispute call",
    color: "#8b5cf6",
  },
  {
    id: 3,
    title: "Tight Struct Packing — bool Next to address",
    tag: "OPT 3",
    contract: "LandRegistry.sol",
    targetFn: "Property struct (affects registerProperty, markPropertyDisputed)",
    principle:
      "The EVM stores state in 32-byte slots. `address` occupies 20 bytes; `bool` occupies 1 byte. Together they total 21 bytes — fitting in ONE slot. Placing `bool disputed` separately from `address owner` wastes a full storage slot, costing an extra SSTORE (~20,000 gas) on every property registration.",
    remixTest:
      "1. Deploy Opt3_Before and Opt3_After from GasOptimizationShowcase.sol\n2. Call register(1, yourAddress, 'Mumbai', 500, 1000, 'QmHash') on both\n3. Compare 'transaction cost' — After is ~20,000 gas cheaper (one fewer SSTORE)",
    before: {
      label: "BEFORE — bool disputed in a separate storage slot",
      code: `// LandRegistry.sol — Property struct BEFORE
struct Property {
    uint id;                 // slot 0 (32 bytes)
    address owner;           // slot 1 (20 bytes — 12 bytes wasted)
    string location;         // slot 2+ (dynamic, own slots)
    uint area;               // next slot
    uint price;              // next slot
    string documentHash;     // next slots (dynamic)
    bool disputed;           // NEW SLOT (1 byte — 31 bytes WASTED!) ← problem
    uint timestamp;          // next slot
}
// Total: address and bool each occupy separate slots → wastes 1 slot`,
      gasNote: "1 extra SSTORE = ~20,000 gas per property registration",
      gasValue: 20000,
    },
    after: {
      label: "AFTER — bool packed with address (same slot)",
      code: `// LandRegistry.sol — Property struct AFTER
struct Property {
    uint id;                 // slot 0 (32 bytes)
    address owner;           // slot 1 (20 bytes)
    bool disputed;           // slot 1 (+ 1 byte = 21 bytes) ← PACKED with owner!
    string location;         // slot 2+ (dynamic, own slots)
    uint area;               // next slot
    uint price;              // next slot
    string documentHash;     // next slots (dynamic)
    uint timestamp;          // next slot
}
// address (20) + bool (1) = 21 bytes → share ONE 32-byte slot
// Saves 1 SSTORE on every registerProperty call`,
      gasNote: "address+bool share 1 slot → 1 fewer SSTORE",
      gasValue: 0,
    },
    saving: 20000,
    savingNote: "~20,000 gas saved per registerProperty call (1 fewer SSTORE)",
    color: "#ec4899",
  },
  {
    id: 4,
    title: "Custom Errors instead of require() Strings",
    tag: "OPT 4",
    contract: "LandRegistry.sol + PropertyDispute.sol",
    targetFn: "All modifiers and validation checks",
    principle:
      'String literals in `require(condition, "message")` are stored in the contract bytecode and ABI-encoded on revert. This inflates deployment gas significantly. Custom errors (`error Foo()`) store only a 4-byte ABI selector, shrinking bytecode and reducing both deployment and revert-path gas.',
    remixTest:
      "1. Deploy Opt4_Before and Opt4_After from GasOptimizationShowcase.sol\n2. Compare 'transaction cost' in the Deploy row — After costs ~5,500 gas less\n3. Call markDisputed(999) on both (invalid ID) — After reverts ~450 gas cheaper",
    before: {
      label: "BEFORE — require() with string messages",
      code: `// LandRegistry.sol — modifiers and checks BEFORE
modifier onlyAdmin() {
    require(msg.sender == admin,
        "Only admin can call this function");       // string in bytecode
    _;
}

function registerProperty(...) public {
    require(_area > 0,
        "Property area must be greater than 0");    // string in bytecode
    require(_price > 0,
        "Property price must be greater than 0");   // string in bytecode
    require(bytes(_location).length > 0,
        "Location cannot be empty");                // string in bytecode
    require(!documentHashExists[_documentHash],
        "This document is already registered - possible duplicate");
    // ...
}
// Deployment gas: ~196,000 | Revert gas per check: ~24,900`,
      gasNote: "Deployment: ~196,000 gas | Revert: ~24,900 gas per check",
      gasValue: 196000,
    },
    after: {
      label: "AFTER — custom errors (4-byte selector only)",
      code: `// LandRegistry.sol — modifiers and checks AFTER
error OnlyAdmin();
error InvalidArea();
error InvalidPrice();
error EmptyLocation();
error DuplicateDocument();
// ... (4-byte selectors only — no strings in bytecode)

modifier onlyAdmin() {
    if (msg.sender != admin) revert OnlyAdmin();    // 4-byte selector
    _;
}

function registerProperty(...) public {
    if (_area == 0) revert InvalidArea();            // 4-byte selector
    if (_price == 0) revert InvalidPrice();          // 4-byte selector
    if (bytes(_location).length == 0) revert EmptyLocation();
    if (documentHashExists[_documentHash]) revert DuplicateDocument();
    // ...
}
// Deployment gas: ~190,500 | Revert gas per check: ~24,450`,
      gasNote: "Deployment: ~190,500 gas | Revert: ~24,450 gas per check",
      gasValue: 190500,
    },
    saving: 5500,
    savingNote: "~5,500 gas saved on deployment + ~450 gas per reverted call",
    color: "#f59e0b",
  },
  {
    id: 5,
    title: "Unchecked Increment + Cached Array Length in Loops",
    tag: "OPT 5",
    contract: "PropertyDispute.sol",
    targetFn: "resolveDispute() and hasActiveDisputes()",
    principle:
      "In Solidity 0.8+, every arithmetic op (including `i++`) includes an overflow/underflow check (~30 gas). Loop counters in bounded loops cannot realistically overflow. Wrapping `++i` in `unchecked {}` skips the check. Additionally, caching `array.length` in a local variable avoids re-reading it from memory on every iteration.",
    remixTest:
      "1. Deploy Opt5_Before and Opt5_After from GasOptimizationShowcase.sol\n2. Call seed(10) on both (creates 10 disputes)\n3. Call countActive_Before() and countActive_After()\n4. Compare 'execution cost' — After is ~270 gas cheaper for 10 iterations",
    before: {
      label: "BEFORE — unchecked length + i++ with overflow check",
      code: `// PropertyDispute.sol — loop in resolveDispute() BEFORE
uint[] memory propertyDisputeIds = propertyDisputes[propertyId];
bool stillHasActiveDisputes = false;

for (uint i = 0; i < propertyDisputeIds.length; i++) {
//                  ^^^^^^^^^^^^^^^^^^^^^^^^^^  MLOAD every iteration
//                                              i++ ← overflow check ~30 gas/iter
    if (!disputes[propertyDisputeIds[i]].resolved) {
        stillHasActiveDisputes = true;
        break;
    }
}
// 10 iterations: 10×30 (i++) + 10×3 (.length MLOAD) = 330 gas overhead`,
      gasNote: "~330 gas overhead per 10 iterations (i++ checks + .length reads)",
      gasValue: 330,
    },
    after: {
      label: "AFTER — cached length + unchecked ++i",
      code: `// PropertyDispute.sol — loop in resolveDispute() AFTER
uint[] memory propertyDisputeIds = propertyDisputes[propertyId];

uint256 len = propertyDisputeIds.length;  // cache ONCE (1 MLOAD)
bool stillHasActiveDisputes = false;

for (uint256 i = 0; i < len;) {           // stack read ~3 gas each
//                       ^^^  stack variable, not MLOAD
    if (!disputes[propertyDisputeIds[i]].resolved) {
        stillHasActiveDisputes = true;
        break;
    }
    unchecked { ++i; }  // no overflow check = ~3 gas instead of ~30
}
// 10 iterations: 10×3 (++i) + 1×3 (len cached) = 33 gas overhead`,
      gasNote: "~33 gas overhead per 10 iterations (10× cheaper than before)",
      gasValue: 33,
    },
    saving: 297,
    savingNote: "~297 gas saved per 10 iterations (~30 gas per additional iteration)",
    color: "#10b981",
  },
];

// ─── Helper ──────────────────────────────────────────────────────────────────
function GasBar({ before, after, color }) {
  const pct = before === 0 ? 4 : Math.max(4, Math.round((after / before) * 100));
  return (
    <div className="gas-bars-wrap">
      <div className="gas-bar-row">
        <span className="gas-bar-label unopt-lbl">Before</span>
        <div className="gas-bar-track">
          <div className="gas-bar-fill fill-before" style={{ width: "100%" }} />
        </div>
        <span className="gas-bar-num bad">{before.toLocaleString()}</span>
      </div>
      <div className="gas-bar-row">
        <span className="gas-bar-label opt-lbl">After</span>
        <div className="gas-bar-track">
          <div
            className="gas-bar-fill fill-after"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <span className="gas-bar-num good">{after.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GasOptimizations() {
  const [activeOpt, setActiveOpt] = useState(null);
  const [activeTab, setActiveTab] = useState({});

  const toggle = (id) => setActiveOpt(activeOpt === id ? null : id);
  const setTab = (id, tab) => setActiveTab((prev) => ({ ...prev, [id]: tab }));
  const getTab = (id) => activeTab[id] || "before";

  return (
    <section className="panel gas-opt-page">

      {/* ── Hero ── */}
      <div className="go-hero">
        <div className="go-hero-badge">EXP 1 · PART 2</div>
        <h2 className="go-hero-title">⛽ Gas Optimizations</h2>
        <p className="go-hero-sub">
          5 real optimizations applied directly to{" "}
          <code>LandRegistry.sol</code> and <code>PropertyDispute.sol</code>.
          Each card shows the exact code that changed, the gas impact, and
          step-by-step Remix instructions to reproduce the numbers yourself.
        </p>
        <div className="go-hero-files">
          <span className="go-file-pill">📄 LandRegistry.sol</span>
          <span className="go-file-pill">📄 PropertyDispute.sol</span>
          <span className="go-file-pill">🔬 GasOptimizationShowcase.sol (Remix)</span>
        </div>
      </div>

      {/* ── Summary strip ── */}
      <div className="go-summary-strip">
        {OPT_DATA.map((o) => (
          <button
            key={o.id}
            className={`go-summary-chip ${activeOpt === o.id ? "chip-active" : ""}`}
            style={activeOpt === o.id ? { borderColor: o.color, color: o.color } : {}}
            onClick={() => toggle(o.id)}
          >
            <span className="chip-tag" style={{ background: o.color }}>{o.tag}</span>
            <span className="chip-saving">−{o.saving.toLocaleString()} gas</span>
          </button>
        ))}
      </div>

      {/* ── Optimization Cards ── */}
      <div className="go-cards">
        {OPT_DATA.map((opt) => {
          const open = activeOpt === opt.id;
          const tab = getTab(opt.id);
          return (
            <div
              key={opt.id}
              className={`go-card ${open ? "go-card-open" : ""}`}
              style={open ? { borderColor: opt.color + "60" } : {}}
            >
              {/* Card Header */}
              <div
                className="go-card-header"
                onClick={() => toggle(opt.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && toggle(opt.id)}
                aria-expanded={open}
              >
                <div className="go-card-left">
                  <span className="go-opt-badge" style={{ background: opt.color }}>
                    {opt.tag}
                  </span>
                  <div className="go-card-meta">
                    <h3 className="go-card-title">{opt.title}</h3>
                    <span className="go-card-contract">{opt.contract}</span>
                  </div>
                </div>
                <div className="go-card-right">
                  <div className="go-saving-pill" style={{ color: opt.color }}>
                    −{opt.saving.toLocaleString()} gas
                  </div>
                  <span className="go-chevron">{open ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Card Body */}
              {open && (
                <div className="go-card-body">
                  {/* Principle */}
                  <div className="go-principle">
                    <span className="go-principle-icon">💡</span>
                    <p>{opt.principle}</p>
                  </div>

                  <p className="go-target-fn">
                    <strong>Target:</strong> <code>{opt.targetFn}</code>
                  </p>

                  {/* Before / After tabs */}
                  <div className="go-tabs">
                    <button
                      className={`go-tab ${tab === "before" ? "go-tab-active" : ""}`}
                      style={tab === "before" ? { borderColor: "#ef4444", color: "#ef4444" } : {}}
                      onClick={() => setTab(opt.id, "before")}
                    >
                      ❌ Before (Unoptimized)
                    </button>
                    <button
                      className={`go-tab ${tab === "after" ? "go-tab-active" : ""}`}
                      style={tab === "after" ? { borderColor: opt.color, color: opt.color } : {}}
                      onClick={() => setTab(opt.id, "after")}
                    >
                      ✅ After (Optimized)
                    </button>
                    <button
                      className={`go-tab ${tab === "compare" ? "go-tab-active" : ""}`}
                      style={tab === "compare" ? { borderColor: "#94a3b8", color: "#94a3b8" } : {}}
                      onClick={() => setTab(opt.id, "compare")}
                    >
                      ⚖️ Side-by-Side
                    </button>
                  </div>

                  {/* Single panel */}
                  {tab !== "compare" && (
                    <div className="go-single-panel">
                      <div className={`go-version-label ${tab === "before" ? "lbl-before" : "lbl-after"}`}>
                        {tab === "before" ? opt.before.label : opt.after.label}
                      </div>
                      <pre className="go-code">
                        <code>{tab === "before" ? opt.before.code : opt.after.code}</code>
                      </pre>
                      <div className="go-gas-note">
                        <span className={tab === "before" ? "bad" : "good"}>⛽</span>{" "}
                        {tab === "before" ? opt.before.gasNote : opt.after.gasNote}
                      </div>
                    </div>
                  )}

                  {/* Side-by-side */}
                  {tab === "compare" && (
                    <div className="go-compare-grid">
                      <div className="go-compare-col">
                        <div className="go-version-label lbl-before">{opt.before.label}</div>
                        <pre className="go-code go-code-split">
                          <code>{opt.before.code}</code>
                        </pre>
                        <div className="go-gas-note">
                          <span className="bad">⛽</span> {opt.before.gasNote}
                        </div>
                      </div>
                      <div className="go-compare-divider">
                        <span>VS</span>
                      </div>
                      <div className="go-compare-col">
                        <div className="go-version-label lbl-after">{opt.after.label}</div>
                        <pre className="go-code go-code-split">
                          <code>{opt.after.code}</code>
                        </pre>
                        <div className="go-gas-note">
                          <span className="good">⛽</span> {opt.after.gasNote}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Gas Bar */}
                  <GasBar
                    before={opt.before.gasValue}
                    after={opt.after.gasValue}
                    color={opt.color}
                  />

                  {/* Savings callout */}
                  <div className="go-saving-callout" style={{ borderColor: opt.color + "60", background: opt.color + "12" }}>
                    <span className="saving-icon">💰</span>
                    <div>
                      <strong style={{ color: opt.color }}>Gas Saved:</strong>{" "}
                      {opt.savingNote}
                    </div>
                  </div>

                  {/* Remix instructions */}
                  <div className="go-remix-box">
                    <div className="go-remix-header">
                      <span>🔬</span> Verify in Remix IDE
                    </div>
                    <pre className="go-remix-steps">{opt.remixTest}</pre>
                    <p className="go-remix-hint">
                      Open <strong>contracts/GasOptimizationShowcase.sol</strong> → paste into{" "}
                      <a href="https://remix.ethereum.org" target="_blank" rel="noreferrer">
                        remix.ethereum.org
                      </a>{" "}
                      → compile → deploy both <em>_Before</em> and <em>_After</em> contracts.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Summary Table ── */}
      <div className="go-table-wrap">
        <h3 className="go-table-title">📊 Summary — All 5 Optimizations</h3>
        <table className="go-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Optimization</th>
              <th>Contract(s)</th>
              <th>Before</th>
              <th>After</th>
              <th>Gas Saved</th>
            </tr>
          </thead>
          <tbody>
            {OPT_DATA.map((opt) => (
              <tr key={opt.id} onClick={() => toggle(opt.id)} className="go-table-row">
                <td>
                  <span className="go-opt-badge-sm" style={{ background: opt.color }}>
                    {opt.id}
                  </span>
                </td>
                <td className="go-table-name">{opt.title}</td>
                <td className="go-table-contract">{opt.contract.split("+")[0].trim()}</td>
                <td className="num bad">{opt.before.gasValue.toLocaleString()}</td>
                <td className="num good">{opt.after.gasValue.toLocaleString()}</td>
                <td className="num saving">−{opt.saving.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="go-table-note">
          Click any row to expand the optimization detail above. All gas values are modelled or measured from Remix.
        </p>
      </div>

    </section>
  );
}
