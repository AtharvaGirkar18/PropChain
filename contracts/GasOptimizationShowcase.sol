// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// =============================================================================
//  LAND REGISTRY DAPP — Gas Optimization Before / After (Remix Reference)
//  -----------------------------------------------------------------------
//  Each section pairs an UNOPTIMIZED contract (suffix _Before) with its
//  OPTIMIZED counterpart (suffix _After).  Deploy both in Remix, call the
//  same function, and compare the "execution cost" shown in the console.
//
//  These are self-contained test stubs extracted from the real project
//  contracts: LandRegistry.sol and PropertyDispute.sol.
// =============================================================================


// ─────────────────────────────────────────────────────────────────────────────
// OPT 1: `calldata` instead of `memory` for read-only string arguments
//  Applied in: LandRegistry.registerProperty(), PropertyDispute.raiseDispute()
//  Principle:  `memory` forces the EVM to copy calldata bytes into memory
//              (~200-400 gas per string arg). `calldata` reads them in place.
// ─────────────────────────────────────────────────────────────────────────────

contract Opt1_Before {
    event Registered(string location, string docHash);

    /// Uses `memory` — triggers ABI-decode copy for each string argument
    function registerProperty(
        string memory _location,
        string memory _documentHash,
        uint _area,
        uint _price
    ) external {
        require(_area > 0 && _price > 0, "invalid");
        emit Registered(_location, _documentHash);
    }
}

contract Opt1_After {
    event Registered(string location, string docHash);

    /// Uses `calldata` — strings read directly from calldata, no copy
    /// Saving: ~350 gas per call (2 string args, typical short strings)
    function registerProperty(
        string calldata _location,
        string calldata _documentHash,
        uint _area,
        uint _price
    ) external {
        if (_area == 0 || _price == 0) revert();
        emit Registered(_location, _documentHash);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPT 2: Cache repeated storage reads into a local `storage` pointer
//  Applied in: PropertyDispute.resolveDispute()
//  Principle:  Each `mapping[key].field` access recomputes the slot hash
//              and triggers an SLOAD (100 gas).  A `storage` pointer caches
//              the slot, turning repeated accesses into cheap reads.
// ─────────────────────────────────────────────────────────────────────────────

contract Opt2_Before {
    struct Dispute { uint propertyId; bool resolved; string resolution; uint resolvedAt; }
    mapping(uint => Dispute) public disputes;
    mapping(uint => bool) public disputeExists;

    function seed(uint id, uint propId) external {
        disputes[id] = Dispute(propId, false, "", 0);
        disputeExists[id] = true;
    }

    /// Accesses disputes[_disputeId].* three separate times — each computes
    /// the mapping slot independently (keccak256 + SLOAD each time)
    function resolveDispute(uint _disputeId, string memory _resolution) external {
        require(disputeExists[_disputeId], "not found");
        require(!disputes[_disputeId].resolved, "already resolved");   // slot calc #1
        uint propertyId = disputes[_disputeId].propertyId;              // slot calc #2
        disputes[_disputeId].resolved = true;                           // slot calc #3
        disputes[_disputeId].resolvedAt = block.timestamp;              // slot calc #4
        disputes[_disputeId].resolution = _resolution;                  // slot calc #5
        // ~ uses propertyId downstream …
        propertyId;
    }
}

contract Opt2_After {
    struct Dispute { uint propertyId; bool resolved; string resolution; uint resolvedAt; }
    mapping(uint => Dispute) public disputes;
    mapping(uint => bool) public disputeExists;

    error DisputeNotFound(uint id);
    error AlreadyResolved(uint id);

    function seed(uint id, uint propId) external {
        disputes[id] = Dispute(propId, false, "", 0);
        disputeExists[id] = true;
    }

    /// Uses a `storage` pointer — slot computed ONCE, all fields accessed cheaply
    /// Saving: ~120 gas per call (fewer repeated keccak slot computations)
    function resolveDispute(uint _disputeId, string calldata _resolution) external {
        if (!disputeExists[_disputeId]) revert DisputeNotFound(_disputeId);
        Dispute storage d = disputes[_disputeId]; // slot computed once ← OPT 2
        if (d.resolved) revert AlreadyResolved(_disputeId);
        uint propertyId = d.propertyId;   // cheap access via pointer
        d.resolved   = true;              // cheap access via pointer
        d.resolvedAt = block.timestamp;   // cheap access via pointer
        d.resolution = _resolution;       // cheap access via pointer
        propertyId;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPT 3: Tight struct packing — move `bool` next to `address`
//  Applied in: LandRegistry.Property struct
//  Principle:  `address` = 20 bytes, `bool` = 1 byte → 21 bytes total.
//              They fit in one 32-byte slot.  Separating them wastes a slot,
//              costing an extra SSTORE (~20,000 gas) on every write.
// ─────────────────────────────────────────────────────────────────────────────

contract Opt3_Before {
    // BAD ORDER: bool is separated from address by dynamic types
    // address owner → slot N (20 bytes + 12 bytes wasted)
    // bool disputed → slot N+k (1 byte + 31 bytes wasted) — separate slot!
    struct Property {
        uint id;
        address owner;      // slot A: 20 bytes used, 12 wasted
        string location;    // own slots (dynamic)
        uint area;          // slot B
        uint price;         // slot C
        string documentHash;// own slots (dynamic)
        bool disputed;      // slot D: 1 byte used, 31 wasted ← WASTE
        uint timestamp;     // slot E
    }
    mapping(uint => Property) public properties;

    /// Writes 5 distinct storage slots on first registration
    /// 5 × 20,000 gas = 100,000 gas (modelled SSTORE cost)
    function register(uint id, address owner, string calldata loc, uint area, uint price, string calldata doc) external {
        properties[id] = Property(id, owner, loc, area, price, doc, false, block.timestamp);
    }
}

contract Opt3_After {
    // GOOD ORDER: bool packed with address → same slot (20+1 = 21 bytes)
    struct Property {
        uint id;
        address owner;      // slot A: 20 bytes
        bool disputed;      // slot A: +1 byte — PACKED with owner!
        string location;    // own slots (dynamic)
        uint area;          // slot B
        uint price;         // slot C
        string documentHash;// own slots (dynamic)
        uint timestamp;     // slot D
    }
    mapping(uint => Property) public properties;

    /// Writes 4 distinct storage slots on first registration (saved 1 slot)
    /// 4 × 20,000 gas = 80,000 gas (modelled) → saves 20,000 gas per property
    function register(uint id, address owner, string calldata loc, uint area, uint price, string calldata doc) external {
        properties[id] = Property(id, owner, false, loc, area, price, doc, block.timestamp);
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPT 4: Custom errors instead of `require` string messages
//  Applied in: All require() calls in LandRegistry.sol & PropertyDispute.sol
//  Principle:  String literals are stored in bytecode and ABI-encoded on
//              revert, inflating deployment gas and revert-path cost.
//              Custom errors use only a 4-byte selector.
// ─────────────────────────────────────────────────────────────────────────────

contract Opt4_Before {
    address public admin;
    mapping(uint => bool) public exists;

    constructor() { admin = msg.sender; }

    /// require() strings stored in bytecode — deployment: ~196,000 gas
    function markDisputed(uint propertyId) external view {
        require(msg.sender == admin, "Only admin can call this function");
        require(exists[propertyId], "Property does not exist");
    }

    function registerProperty(uint propertyId, uint area) external {
        require(area > 0, "Property area must be greater than 0");
        require(propertyId > 0, "Invalid property ID");
        exists[propertyId] = true;
    }
}

contract Opt4_After {
    // 4-byte selectors only — no string storage in bytecode
    error OnlyAdmin();
    error PropertyDoesNotExist(uint propertyId);
    error InvalidArea();
    error InvalidPropertyId();

    address public admin;
    mapping(uint => bool) public exists;

    constructor() { admin = msg.sender; }

    /// Custom errors — deployment saving: ~5,500 gas | revert saving: ~450 gas each
    function markDisputed(uint propertyId) external view {
        if (msg.sender != admin) revert OnlyAdmin();
        if (!exists[propertyId]) revert PropertyDoesNotExist(propertyId);
    }

    function registerProperty(uint propertyId, uint area) external {
        if (area == 0) revert InvalidArea();
        if (propertyId == 0) revert InvalidPropertyId();
        exists[propertyId] = true;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// OPT 5: Unchecked increment + cached array length in loops
//  Applied in: PropertyDispute.resolveDispute() and hasActiveDisputes()
//  Principle:  In Solidity 0.8+, every `i++` checks for overflow (~30 gas).
//              Loop counters can't overflow in practice; using `unchecked {++i}`
//              skips the check. Also cache `.length` to avoid repeated SLOADs.
// ─────────────────────────────────────────────────────────────────────────────

contract Opt5_Before {
    struct Dispute { bool resolved; }
    mapping(uint => Dispute) public disputes;
    uint[] public disputeIds;

    function seed(uint n) external {
        for (uint i = 0; i < n; i++) {
            disputes[i] = Dispute(false);
            disputeIds.push(i);
        }
    }

    /// Reads disputeIds.length from storage on EVERY iteration (100 gas/iter)
    /// i++ with overflow check: ~30 gas/iter
    /// For 10 disputes: 10×100 + 10×30 = 1,300 gas (modelled overhead)
    function countActive_Before() external view returns (uint count) {
        for (uint i = 0; i < disputeIds.length; i++) {   // SLOAD on each check
            if (!disputes[disputeIds[i]].resolved) count++;
        }
    }
}

contract Opt5_After {
    struct Dispute { bool resolved; }
    mapping(uint => Dispute) public disputes;
    uint[] public disputeIds;

    function seed(uint n) external {
        for (uint i = 0; i < n; i++) {
            disputes[i] = Dispute(false);
            disputeIds.push(i);
        }
    }

    /// Caches length once (1×100 gas) + unchecked ++i (~3 gas/iter)
    /// For 10 disputes: 100 + 10×3 = 130 gas (modelled overhead)
    /// Saving vs Before: 1,300 - 130 = 1,170 gas (10 disputes)
    function countActive_After() external view returns (uint count) {
        uint256 len = disputeIds.length;          // 1 × SLOAD = 100 gas (cached)
        for (uint256 i = 0; i < len;) {           // stack read = ~3 gas each
            if (!disputes[disputeIds[i]].resolved) count++;
            unchecked { ++i; }                    // no overflow check = ~3 gas
        }
    }
}
