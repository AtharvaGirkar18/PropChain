const Web3 = require("web3");

async function getGanacheAccounts() {
  try {
    const web3 = new Web3("http://127.0.0.1:7545");

    const accounts = await web3.eth.getAccounts();
    console.log("\n=== GANACHE ACCOUNTS ===\n");

    for (let i = 0; i < Math.min(3, accounts.length); i++) {
      const account = accounts[i];
      const balance = await web3.eth.getBalance(account);
      const balanceEth = web3.utils.fromWei(balance, "ether");
      console.log(`Account ${i}: ${account}`);
      console.log(`Balance: ${balanceEth} ETH\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

getGanacheAccounts();
