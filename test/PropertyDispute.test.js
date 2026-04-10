const LandRegistry = artifacts.require("LandRegistry");
const PropertyDispute = artifacts.require("PropertyDispute");

contract("PropertyDispute", (accounts) => {
  let landRegistry;
  let propertyDispute;
  const owner = accounts[0];
  const buyer = accounts[1];
  const claimant = accounts[2];
  const admin = accounts[0];

  // Helper function to generate hash
  const generateHash = (str) => {
    return "QmHash" + Math.random().toString(36).substr(2, 9);
  };

  beforeEach(async () => {
    landRegistry = await LandRegistry.new({ from: owner });
    propertyDispute = await PropertyDispute.new(landRegistry.address, {
      from: admin,
    });

    // Authorize PropertyDispute contract in LandRegistry
    await landRegistry.setPropertyDisputeContract(propertyDispute.address, {
      from: admin,
    });

    // Register a property for testing
    const location = "123 Main Street, New Delhi";
    const area = 5000;
    const price = web3.utils.toWei("10", "ether");
    const documentHash = generateHash("property1");

    await landRegistry.registerProperty(location, area, price, documentHash, {
      from: owner,
    });
  });

  describe("Dispute Raising", () => {
    it("should raise a dispute on a property", async () => {
      const reason = "Previous owner claims ownership still valid";
      const result = await propertyDispute.raiseDispute(1, reason, {
        from: claimant,
      });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "DisputeRaised");
      assert.equal(result.logs[0].args.disputeId, 1);
      assert.equal(result.logs[0].args.propertyId, 1);
      assert.equal(result.logs[0].args.raisedBy, claimant);
    });

    it("should not raise dispute with empty reason", async () => {
      try {
        await propertyDispute.raiseDispute(1, "", { from: claimant });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Reason cannot be empty"));
      }
    });

    it("should not raise dispute on non-existent property", async () => {
      try {
        await propertyDispute.raiseDispute(999, "Some reason", {
          from: claimant,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Property does not exist"));
      }
    });

    it("should mark property as disputed when dispute is raised", async () => {
      const reason = "Document authenticity in question";
      await propertyDispute.raiseDispute(1, reason, { from: claimant });

      // Verify property is marked as disputed in LandRegistry
      const isDisputed = await landRegistry.isPropertyDisputed(1);
      assert.equal(isDisputed, true);
    });
  });

  describe("Dispute Resolution", () => {
    beforeEach(async () => {
      const reason = "Previous owner claims ownership";
      await propertyDispute.raiseDispute(1, reason, { from: claimant });
    });

    it("should resolve a dispute", async () => {
      const resolution =
        "Verified documents ownership is valid. Dispute closed.";
      const result = await propertyDispute.resolveDispute(1, resolution, {
        from: admin,
      });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "DisputeResolved");
      assert.equal(result.logs[0].args.disputeId, 1);
    });

    it("should only allow admin to resolve dispute", async () => {
      try {
        await propertyDispute.resolveDispute(1, "Resolved", { from: claimant });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Only admin"));
      }
    });

    it("should not resolve dispute with empty resolution", async () => {
      try {
        await propertyDispute.resolveDispute(1, "", { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Resolution cannot be empty"));
      }
    });

    it("should clear property disputed status when resolve", async () => {
      const resolution = "Verified documents. Dispute dismissed.";
      await propertyDispute.resolveDispute(1, resolution, { from: admin });

      const isDisputed = await landRegistry.isPropertyDisputed(1);
      assert.equal(isDisputed, false);
    });

    it("should not resolve an already resolved dispute", async () => {
      await propertyDispute.resolveDispute(1, "First resolution", {
        from: admin,
      });

      try {
        await propertyDispute.resolveDispute(1, "Second resolution", {
          from: admin,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Dispute is already resolved"));
      }
    });
  });

  describe("Dispute Retrieval", () => {
    beforeEach(async () => {
      const reason1 = "Document authenticity in question";
      const reason2 = "Boundary dispute with neighboring property";
      await propertyDispute.raiseDispute(1, reason1, { from: claimant });
      await propertyDispute.raiseDispute(1, reason2, { from: accounts[3] });
    });

    it("should get all disputes for a property", async () => {
      const disputes = await propertyDispute.getDisputesByProperty(1);

      assert.equal(disputes.length, 2);
      assert.equal(disputes[0], 1);
      assert.equal(disputes[1], 2);
    });

    it("should get dispute details", async () => {
      const dispute = await propertyDispute.getDisputeDetails(1);

      assert.equal(dispute.id, 1);
      assert.equal(dispute.propertyId, 1);
      assert.equal(dispute.raisedBy, claimant);
      assert.equal(dispute.resolved, false);
    });

    it("should check if property has active disputes", async () => {
      let hasDisputes = await propertyDispute.hasActiveDisputes(1);
      assert.equal(hasDisputes, true);

      // Resolve first dispute
      await propertyDispute.resolveDispute(1, "Resolved", { from: admin });

      // Should still have active dispute (second one)
      hasDisputes = await propertyDispute.hasActiveDisputes(1);
      assert.equal(hasDisputes, true);

      // Resolve second dispute
      await propertyDispute.resolveDispute(2, "Resolved", { from: admin });

      // Now should have no active disputes
      hasDisputes = await propertyDispute.hasActiveDisputes(1);
      assert.equal(hasDisputes, false);
    });
  });

  describe("Dispute Counters", () => {
    it("should track dispute count", async () => {
      let count = await propertyDispute.getDisputeCount();
      assert.equal(count, 0);

      await propertyDispute.raiseDispute(1, "First dispute", {
        from: claimant,
      });
      count = await propertyDispute.getDisputeCount();
      assert.equal(count, 1);

      await propertyDispute.raiseDispute(1, "Second dispute", {
        from: accounts[3],
      });
      count = await propertyDispute.getDisputeCount();
      assert.equal(count, 2);
    });

    it("should track dispute count by property", async () => {
      // Register another property
      await landRegistry.registerProperty(
        "456 Oak Street",
        3000,
        web3.utils.toWei("5", "ether"),
        generateHash("property2"),
        { from: owner },
      );

      await propertyDispute.raiseDispute(1, "Dispute 1", { from: claimant });
      await propertyDispute.raiseDispute(1, "Dispute 2", { from: accounts[3] });
      await propertyDispute.raiseDispute(2, "Dispute 3", { from: claimant });

      const count1 = await propertyDispute.getDisputeCountByProperty(1);
      const count2 = await propertyDispute.getDisputeCountByProperty(2);

      assert.equal(count1, 2);
      assert.equal(count2, 1);
    });
  });
});
