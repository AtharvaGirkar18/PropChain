const Web3 = require("web3");

async function checkGanache() {
  try {
    const web3 = new Web3("http://127.0.0.1:7545");

    // Get all accounts
    const accounts = await web3.eth.getAccounts();
    console.log("\n=== GANACHE ACCOUNTS ===");
    console.log("Total accounts:", accounts.length);

    // Check balance of first 3 accounts
    for (let i = 0; i < Math.min(3, accounts.length); i++) {
      const account = accounts[i];
      const balance = await web3.eth.getBalance(account);
      const balanceEth = web3.utils.fromWei(balance, "ether");
      console.log(`\nAccount ${i}:`);
      console.log(`  Address: ${account}`);
      console.log(`  Balance: ${balanceEth} ETH`);
    }

    // Specifically check the account that's trying to connect
    const testAccount = "0x90c00ab297d0be29af4e7cf550ced9f2f9fb331e";
    console.log(`\n=== CHECKING SPECIFIC ACCOUNT ===`);
    console.log(`Address: ${testAccount}`);

    try {
      const balance = await web3.eth.getBalance(testAccount);
      const balanceEth = web3.utils.fromWei(balance, "ether");
      console.log(`Balance: ${balanceEth} ETH`);
      console.log(
        `Is in accounts list: ${accounts.includes(testAccount) || accounts.some((a) => a.toLowerCase() === testAccount.toLowerCase())}`,
      );
    } catch (err) {
      console.log(`Error checking balance: ${err.message}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
  process.exit(0);
}

checkGanache();
