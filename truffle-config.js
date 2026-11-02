/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation, and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * https://trufflesuite.com/docs/truffle/reference/configuration
 */

module.exports = {
  /**
   * Networks define how you connect to your Ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one, Truffle
   * will spin up a managed Ganache instance for you on port 9545 when you
   * run `develop` or `test`. You can ask a trusted provider like Infura
   * to be your web3 provider, but always give it your mnemonics
   * so it can sign your transactions.
   */
  networks: {
    /**
     * Development network - LOCAL GANACHE
     * Run Ganache on your local machine and connect to it
     * Make sure Ganache is running on port 7545
     */
    development: {
      host: "127.0.0.1", // Localhost
      port: 7545, // Ganache RPC Port (default)
      network_id: "*", // Match any network ID
    },

    /**
     * Sepolia Testnet (for Lab 8)
     * Uncomment and configure with your Infura/Alchemy endpoint
     */
    // sepolia: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://sepolia.infura.io/v3/${infuraKey}`),
    //   network_id: 11155111,    // Sepolia's id
    //   gas: 5500000,            // Gas limit
    //   confirmations: 2,        // # of confirmations to wait between deployments
    //   timeoutBlocks: 200,      // # of blocks before a deployment times out
    //   skipDryRun: true         // Skip dry run before migrations
    // },

    /**
     * Mainnet (Production - use with extreme caution)
     */
    // mainnet: {
    //   provider: () => new HDWalletProvider(mnemonic, `https://mainnet.infura.io/v3/${infuraKey}`),
    //   network_id: 1,
    //   gas: 5500000,
    //   confirmations: 2,
    //   timeoutBlocks: 200,
    //   skipDryRun: true
    // }
  },

  /**
   * Set default mocha options here, use the host and port arguments
   * to configure a custom test blockchain instance.
   */
  mocha: {
    // timeout: 5000
  },

  /**
   * Configure your compilers here.
   *
   * Solidity: https://github.com/ethereum/solc-js
   */
  compilers: {
    solc: {
      version: "0.8.20", // Bumped from 0.8.0 — custom errors (OPT 4) require >=0.8.4
      // docker: true,            // Use "0.5.1" you've installed locally with docker
      // settings: {
      //   optimizer: {
      //     enabled: false,
      //     runs: 200
      //   },
      //   evmVersion: "byzantium"
      // }
    },
  },

  /**
   * Truffle DB is currently disabled by default; to enable it, change enabled:
   * false in the db section below, or via the --db flag.
   * NOTE: It is not possible to migrate your contracts to truffle DB and you should
   * not rely on commands that rely on the knowledge gained from migration, such as
   * `truffle test` without a migration, `truffle console`, --dry-run and --reset.
   *
   *
   * NOTE: For migrations with the solo migrator, the directory of the migrator smart
   * contract is not assumed to be within the contracts directory. You may specify
   * a different file path for the solo migrator, so long as it ends in ".sol";
   *
   *
   * NOTE: Unless you specify the `skipFiles` option, files inside "test" subdirectory of
   * "migrations" folder are treated as test files for mocha, and not migration files.
   */
  db: {
    enabled: false,
  },
};
