const { Web3 } = require("web3");

const web3 = new Web3("http://127.0.0.1:7545");

// Colors for better readability
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const log = {
  header: (msg) =>
    console.log(`\n${colors.bright}${colors.blue}${"=".repeat(80)}`),
  title: (msg) => console.log(`${colors.bright}${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}>>> ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
};

async function viewBlockchain() {
  try {
    log.header();
    log.title("🔍 BLOCKCHAIN EXPLORER - GANACHE LOCAL BLOCKCHAIN");
    log.header();

    // ============ NETWORK INFO ============
    log.section("NETWORK INFORMATION");
    const chainId = await web3.eth.getChainId();
    const blockCount = await web3.eth.getBlockNumber();
    const gasPrice = await web3.eth.getGasPrice();

    console.log(`Chain ID: ${colors.bright}${chainId}${colors.reset}`);
    console.log(`Total Blocks: ${colors.bright}${blockCount}${colors.reset}`);
    console.log(
      `Gas Price: ${colors.bright}${web3.utils.fromWei(gasPrice, "gwei")} gwei${colors.reset}`,
    );

    // ============ ACCOUNTS ============
    log.section("ACCOUNTS & BALANCES");
    const accounts = await web3.eth.getAccounts();
    console.log(
      `\nTotal Accounts: ${colors.bright}${accounts.length}${colors.reset}\n`,
    );

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      const balance = await web3.eth.getBalance(account);
      const balanceEth = web3.utils.fromWei(balance, "ether");
      const code = await web3.eth.getCode(account);
      const isContract = code !== "0x";

      const type = isContract
        ? `${colors.magenta}[CONTRACT]${colors.reset}`
        : "[Account]";
      const balanceDisplay = isContract
        ? `N/A`
        : `${parseFloat(balanceEth).toFixed(4)} ETH`;

      console.log(`${type} Account ${i}: ${account}`);
      console.log(`   Balance: ${balanceDisplay}`);
      if (isContract) {
        console.log(`   Contract Code Size: ${code.length / 2 - 1} bytes`);
      }
      console.log();
    }

    // ============ ALL BLOCKS & TRANSACTIONS ============
    log.section("BLOCKS & TRANSACTIONS HISTORY");
    const totalBlocks = Number(blockCount);
    console.log(
      `\nScanning ${totalBlocks + 1} blocks (0 to ${totalBlocks})...\n`,
    );

    let totalTransactions = 0;
    let totalGasUsed = 0;

    for (let blockNum = 0; blockNum <= totalBlocks; blockNum++) {
      const block = await web3.eth.getBlock(blockNum, true);

      console.log(`${colors.bright}Block #${blockNum}${colors.reset}`);
      const timestamp = Number(block.timestamp);
      console.log(
        `  Timestamp: ${new Date(timestamp * 1000).toLocaleString()}`,
      );
      console.log(`  Miner: ${block.miner}`);
      const gasUsed = Number(block.gasUsed);
      const gasLimit = Number(block.gasLimit);
      console.log(`  Gas Used: ${gasUsed} / ${gasLimit}`);
      console.log(`  Transactions: ${block.transactions.length}`);

      if (block.transactions.length > 0) {
        console.log(`  ${colors.yellow}Transaction Details:${colors.reset}`);

        block.transactions.forEach((tx, txIndex) => {
          totalTransactions++;
          const gas = Number(tx.gas);
          totalGasUsed += gas;

          console.log(
            `    ${colors.cyan}TX ${txIndex + 1}:${colors.reset} ${tx.hash}`,
          );
          console.log(`      From: ${tx.from}`);
          console.log(`      To: ${tx.to || "[Contract Creation]"}`);
          const ethValue = web3.utils.fromWei(String(tx.value), "ether");
          const gPrice = web3.utils.fromWei(String(tx.gasPrice), "gwei");
          console.log(`      Value: ${ethValue} ETH`);
          console.log(`      Gas: ${gas} | Gas Price: ${gPrice} gwei`);
          console.log(`      Nonce: ${Number(tx.nonce)}`);
          console.log(
            `      Input Data: ${tx.input.substring(0, 50)}${tx.input.length > 50 ? "..." : ""}`,
          );
        });
      }
      console.log();
    }

    // ============ SUMMARY ============
    log.section("BLOCKCHAIN SUMMARY");
    console.log(
      `Total Transactions: ${colors.bright}${totalTransactions}${colors.reset}`,
    );
    console.log(
      `Total Gas Used: ${colors.bright}${totalGasUsed.toLocaleString()}${colors.reset}`,
    );
    console.log(
      `Average Gas per Tx: ${colors.bright}${Math.round(totalGasUsed / Math.max(totalTransactions, 1))}${colors.reset}`,
    );

    // ============ NETWORK STATUS ============
    log.section("NETWORK STATUS");
    const nodeInfo = await web3.eth.getNodeInfo();
    console.log(`Node: ${nodeInfo}`);

    const isListening = await web3.eth.net.isListening();
    const peerCount = await web3.eth.net.getPeerCount();

    console.log(
      `Listening: ${colors.green}${isListening ? "Yes" : "No"}${colors.reset}`,
    );
    console.log(`Connected Peers: ${peerCount}`);

    log.success("Blockchain exploration complete!");
    log.header();
  } catch (error) {
    log.error(`Error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run the explorer
viewBlockchain();
