#!/usr/bin/env node

// Simple verification script
const fs = require("fs");
const path = require("path");

console.log("🔍 Verifying Land Registry DApp Setup...\n");

// Check files exist
const files = [
  "contracts/LandRegistry.sol",
  "contracts/PropertyDispute.sol",
  "contracts/Migrations.sol",
  "test/LandRegistry.test.js",
  "test/PropertyDispute.test.js",
  "migrations/1_initial_migration.js",
  "migrations/2_deploy_contracts.js",
];

let allGood = true;

files.forEach((file) => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file}`);
    allGood = false;
  }
});

console.log("\n📋 Checking for key code elements...\n");

// Check LandRegistry has the new modifier
const landRegistryPath = path.join(__dirname, "contracts/LandRegistry.sol");
const landRegistryContent = fs.readFileSync(landRegistryPath, "utf8");

if (landRegistryContent.includes("onlyAdminOrDisputeContract")) {
  console.log("✅ LandRegistry has onlyAdminOrDisputeContract modifier");
} else {
  console.log("❌ Missing onlyAdminOrDisputeContract modifier in LandRegistry");
  allGood = false;
}

if (landRegistryContent.includes("setPropertyDisputeContract")) {
  console.log("✅ LandRegistry has setPropertyDisputeContract function");
} else {
  console.log("❌ Missing setPropertyDisputeContract function");
  allGood = false;
}

if (landRegistryContent.includes("address public propertyDisputeContract")) {
  console.log("✅ LandRegistry has propertyDisputeContract state variable");
} else {
  console.log("❌ Missing propertyDisputeContract state variable");
  allGood = false;
}

// Check test setup
const testPath = path.join(__dirname, "test/PropertyDispute.test.js");
const testContent = fs.readFileSync(testPath, "utf8");

if (testContent.includes("setPropertyDisputeContract")) {
  console.log("✅ PropertyDispute test authorizes contract");
} else {
  console.log("❌ PropertyDispute test missing authorization");
  allGood = false;
}

// Check migration
const migrationPath = path.join(__dirname, "migrations/2_deploy_contracts.js");
const migrationContent = fs.readFileSync(migrationPath, "utf8");

if (migrationContent.includes("setPropertyDisputeContract")) {
  console.log("✅ Migration authorizes PropertyDispute contract");
} else {
  console.log("❌ Migration missing setPropertyDisputeContract call");
  allGood = false;
}

console.log(
  "\n" +
    (allGood
      ? "✅ All checks passed! Ready to test."
      : "❌ Some issues found."),
);
