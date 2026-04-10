const LandRegistry = artifacts.require("LandRegistry");

contract("LandRegistry", (accounts) => {
  let landRegistry;
  const owner = accounts[0];
  const buyer = accounts[1];
  const admin = accounts[0];

  // Helper function to calculate IPFS hash (simplified)
  const generateHash = (str) => {
    return "QmHash" + Math.random().toString(36).substr(2, 9);
  };

  beforeEach(async () => {
    landRegistry = await LandRegistry.new({ from: owner });
  });

  describe("Property Registration", () => {
    it("should register a new property", async () => {
      const location = "123 Main Street, New Delhi";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      const result = await landRegistry.registerProperty(
        location,
        area,
        price,
        documentHash,
        { from: owner },
      );

      // Check event was emitted
      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "PropertyRegistered");
      assert.equal(result.logs[0].args.propertyId, 1);
      assert.equal(result.logs[0].args.owner, owner);
    });

    it("should not register property with empty location", async () => {
      try {
        await landRegistry.registerProperty(
          "",
          5000,
          web3.utils.toWei("10", "ether"),
          generateHash("property1"),
          { from: owner },
        );
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Location cannot be empty"));
      }
    });

    it("should not register property with zero area", async () => {
      try {
        await landRegistry.registerProperty(
          "123 Main Street",
          0,
          web3.utils.toWei("10", "ether"),
          generateHash("property1"),
          { from: owner },
        );
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Property area must be greater than 0"));
      }
    });

    it("should prevent duplicate document registration", async () => {
      const location = "123 Main Street";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      await landRegistry.registerProperty(location, area, price, documentHash, {
        from: owner,
      });

      try {
        await landRegistry.registerProperty(
          "456 Another Street",
          3000,
          price,
          documentHash,
          { from: owner },
        );
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("This document is already registered"));
      }
    });
  });

  describe("Ownership Transfer", () => {
    beforeEach(async () => {
      const location = "123 Main Street";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      await landRegistry.registerProperty(location, area, price, documentHash, {
        from: owner,
      });
    });

    it("should transfer ownership to a new owner", async () => {
      const result = await landRegistry.transferOwnership(1, buyer, {
        from: owner,
      });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "OwnershipTransferred");
      assert.equal(result.logs[0].args.propertyId, 1);
      assert.equal(result.logs[0].args.previousOwner, owner);
      assert.equal(result.logs[0].args.newOwner, buyer);

      const property = await landRegistry.getPropertyDetails(1);
      assert.equal(property.owner, buyer);
    });

    it("should not allow non-owner to transfer property", async () => {
      try {
        await landRegistry.transferOwnership(1, buyer, { from: buyer });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("You are not the owner"));
      }
    });

    it("should not transfer to the same owner", async () => {
      try {
        await landRegistry.transferOwnership(1, owner, { from: owner });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("New owner must be different"));
      }
    });

    it("should not transfer disputed property", async () => {
      await landRegistry.markPropertyDisputed(1, { from: admin });

      try {
        await landRegistry.transferOwnership(1, buyer, { from: owner });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Property is currently disputed"));
      }
    });
  });

  describe("Property Details and Status", () => {
    beforeEach(async () => {
      const location = "123 Main Street";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      await landRegistry.registerProperty(location, area, price, documentHash, {
        from: owner,
      });
    });

    it("should retrieve property details", async () => {
      const property = await landRegistry.getPropertyDetails(1);

      assert.equal(property.id, 1);
      assert.equal(property.owner, owner);
      assert.equal(property.location, "123 Main Street");
      assert.equal(property.area, 5000);
      assert.equal(property.disputed, false);
    });

    it("should check if property title is clean", async () => {
      const isClean = await landRegistry.isTitleClean(1);
      assert.equal(isClean, true);
    });

    it("should check if property is disputed", async () => {
      let isDisputed = await landRegistry.isPropertyDisputed(1);
      assert.equal(isDisputed, false);

      await landRegistry.markPropertyDisputed(1, { from: admin });
      isDisputed = await landRegistry.isPropertyDisputed(1);
      assert.equal(isDisputed, true);
    });
  });

  describe("Dispute Management", () => {
    beforeEach(async () => {
      const location = "123 Main Street";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      await landRegistry.registerProperty(location, area, price, documentHash, {
        from: owner,
      });
    });

    it("should mark property as disputed", async () => {
      const result = await landRegistry.markPropertyDisputed(1, {
        from: admin,
      });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "PropertyMarkedDisputed");

      const property = await landRegistry.getPropertyDetails(1);
      assert.equal(property.disputed, true);
    });

    it("should only allow admin to mark disputed", async () => {
      try {
        await landRegistry.markPropertyDisputed(1, { from: buyer });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(error.message.includes("Only admin"));
      }
    });

    it("should resolve dispute", async () => {
      await landRegistry.markPropertyDisputed(1, { from: admin });
      const result = await landRegistry.resolvePropertyDispute(1, {
        from: admin,
      });

      assert.equal(result.logs.length, 1);
      assert.equal(result.logs[0].event, "PropertyDisputeResolved");

      const property = await landRegistry.getPropertyDetails(1);
      assert.equal(property.disputed, false);
    });
  });

  describe("Ownership History", () => {
    beforeEach(async () => {
      const location = "123 Main Street";
      const area = 5000;
      const price = web3.utils.toWei("10", "ether");
      const documentHash = generateHash("property1");

      await landRegistry.registerProperty(location, area, price, documentHash, {
        from: owner,
      });
    });

    it("should track ownership history", async () => {
      const thirdParty = accounts[2];

      await landRegistry.transferOwnership(1, buyer, { from: owner });
      await landRegistry.transferOwnership(1, thirdParty, { from: buyer });

      const history = await landRegistry.getOwnershipHistory(1);

      assert.equal(history.length, 3);
      assert.equal(history[0], owner);
      assert.equal(history[1], buyer);
      assert.equal(history[2], thirdParty);
    });
  });
});
