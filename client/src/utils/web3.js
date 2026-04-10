import Web3 from "web3";

let web3;
let selectedAccount;

/**
 * Detect if MetaMask or any Ethereum provider is available
 */
export const detectProvider = () => {
  if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
    return window.ethereum;
  }
  return null;
};

/**
 * Connect to wallet (MetaMask)
 */
export const connectWallet = async () => {
  try {
    const provider = detectProvider();
    if (!provider) {
      throw new Error(
        "MetaMask not installed. Please install MetaMask extension.",
      );
    }

    // Request account access
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });

    console.log("All available accounts:", accounts);
    selectedAccount = accounts[0];
    console.log("Selected account:", selectedAccount);
    web3 = new Web3(provider);

    // Log current network info
    const chainId = await web3.eth.getChainId();
    console.log("Connected to chain ID:", chainId);

    return {
      success: true,
      account: selectedAccount,
      web3: web3,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get current connected account
 */
export const getAccount = () => {
  return selectedAccount;
};

/**
 * Get Web3 instance
 */
export const getWeb3 = () => {
  if (!web3) {
    const provider = detectProvider();
    if (provider) {
      web3 = new Web3(provider);
    } else {
      throw new Error("Web3 not initialized. Please connect wallet first.");
    }
  }
  return web3;
};

/**
 * Get contract instance
 * @param {Array} abi - Contract ABI
 * @param {String} address - Contract address
 */
export const getContract = (abi, address) => {
  try {
    const web3Instance = getWeb3();
    return new web3Instance.eth.Contract(abi, address);
  } catch (error) {
    throw new Error(`Failed to get contract: ${error.message}`);
  }
};

/**
 * Get balance of account
 */
export const getBalance = async (account) => {
  try {
    if (!account) {
      console.error("No account provided to getBalance");
      return "0";
    }

    // Make sure provider is available
    const provider = detectProvider();
    if (!provider) {
      console.error("No provider detected");
      return "0";
    }

    const web3Instance = new Web3(provider);
    console.log("Fetching balance for:", account);

    const balanceWei = await web3Instance.eth.getBalance(account);
    console.log("Raw balance in Wei:", balanceWei);

    // balanceWei could be 0n (BigInt zero), so check for null/undefined specifically
    if (balanceWei == null) {
      console.error("No balance returned");
      return "0";
    }

    const balanceEth = web3Instance.utils.fromWei(
      balanceWei.toString(),
      "ether",
    );
    console.log("Converted balance in ETH:", balanceEth);

    return balanceEth;
  } catch (error) {
    console.error("Error fetching balance:", error.message, error);
    return "0";
  }
};

/**
 * Convert Wei to Ether
 */
export const fromWei = (value) => {
  const web3Instance = getWeb3();
  return web3Instance.utils.fromWei(value, "ether");
};

/**
 * Convert Ether to Wei
 */
export const toWei = (value) => {
  const web3Instance = getWeb3();
  return web3Instance.utils.toWei(value.toString(), "ether");
};

/**
 * Check if connected to Ganache (development network)
 */
export const isConnectedToGanache = async () => {
  try {
    const web3Instance = getWeb3();
    const chainId = await web3Instance.eth.getChainId();
    // Ganache default chain ID is 1337 or 5777
    return chainId === 1337 || chainId === 5777 || chainId === 1; // 1 is for local development
  } catch (error) {
    return false;
  }
};

/**
 * Get network info
 */
export const getNetworkInfo = async () => {
  try {
    const web3Instance = getWeb3();
    const chainId = await web3Instance.eth.getChainId();
    const blockNumber = await web3Instance.eth.getBlockNumber();
    const gasPrice = await web3Instance.eth.getGasPrice();

    return {
      chainId,
      blockNumber,
      gasPrice: web3Instance.utils.fromWei(gasPrice, "gwei"),
    };
  } catch (error) {
    throw new Error(`Failed to get network info: ${error.message}`);
  }
};

/**
 * Estimate gas for a transaction
 */
export const estimateGas = async (to, data, value = 0) => {
  try {
    const web3Instance = getWeb3();
    const gas = await web3Instance.eth.estimateGas({
      from: selectedAccount,
      to: to,
      data: data,
      value: value,
    });
    return gas;
  } catch (error) {
    throw new Error(`Failed to estimate gas: ${error.message}`);
  }
};

/**
 * Extract Solidity revert reason from error
 * Handles different error formats from web3.js and MetaMask
 * @param {Error} error - The error object from contract call
 * @returns {String} The extracted error message
 */
export const extractSolidityError = (error) => {
  const errorStr = error.toString();
  
  // Try to extract from error data
  if (error.data) {
    const data = error.data;
    if (data.message) return data.message;
  }
  
  // Try to extract from error message field
  if (error.message) {
    const message = error.message;
    
    // Look for revert reason in parentheses
    const revertMatch = message.match(/reverted with reason string "(.*?)"/);
    if (revertMatch && revertMatch[1]) {
      return revertMatch[1];
    }
    
    // Look for execution reverted message
    if (message.includes("execution reverted")) {
      return message;
    }
  }
  
  // Return original error string if no specific format found
  return errorStr;
};

/**
 * Watch for account changes
 */
export const watchAccountChanges = (callback) => {
  try {
    const provider = detectProvider();
    if (provider) {
      provider.on("accountsChanged", (accounts) => {
        selectedAccount = accounts[0];
        callback(accounts[0]);
      });
    }
  } catch (error) {
    console.error("Failed to watch account changes:", error);
  }
};

/**
 * Watch for chain changes
 */
export const watchChainChanges = (callback) => {
  try {
    const provider = detectProvider();
    if (provider) {
      provider.on("chainChanged", (chainId) => {
        // Chain ID is in hex format
        callback(parseInt(chainId, 16));
      });
    }
  } catch (error) {
    console.error("Failed to watch chain changes:", error);
  }
};
