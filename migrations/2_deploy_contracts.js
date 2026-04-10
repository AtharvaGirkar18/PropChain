const LandRegistry = artifacts.require("LandRegistry");
const PropertyDispute = artifacts.require("PropertyDispute");

module.exports = function (deployer) {
  // Deploy LandRegistry first
  deployer.deploy(LandRegistry).then(function () {
    // After LandRegistry is deployed, deploy PropertyDispute and pass LandRegistry address
    return deployer
      .deploy(PropertyDispute, LandRegistry.address)
      .then(function () {
        // After PropertyDispute is deployed, authorize it in LandRegistry
        return LandRegistry.deployed().then(function (landRegistry) {
          return landRegistry.setPropertyDisputeContract(
            PropertyDispute.address,
          );
        });
      });
  });
};
