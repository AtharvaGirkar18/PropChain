import { BrowserProvider, Contract, formatEther } from "ethers";

let browserProvider;
let signer;
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
    const injectedProvider = detectProvider();
    if (!injectedProvider) {
      throw new Error(
        "MetaMask not installed. Please install MetaMask extension.",
      );
    }

    const accounts = await injectedProvider.request({
      method: "eth_requestAccounts",
    });

    selectedAccount = accounts[0];
    browserProvider = new BrowserProvider(injectedProvider);
    signer = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();

    return {
      success: true,
      account: selectedAccount,
      provider: browserProvider,
      signer,
      chainId: Number(network.chainId),
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
 * Get Ethers provider instance
 */
export const getProvider = () => {
  if (!browserProvider) {
    const injectedProvider = detectProvider();
    if (injectedProvider) {
      browserProvider = new BrowserProvider(injectedProvider);
    } else {
      throw new Error("Provider not initialized. Please connect wallet first.");
    }
  }
  return browserProvider;
};

/**
 * Backward compatibility alias for old imports
 */
export const getWeb3 = getProvider;

/**
 * Get Ethers signer
 */
export const getSigner = async () => {
  if (signer) return signer;
  const provider = getProvider();
  signer = await provider.getSigner();
  return signer;
};

/**
 * Get contract instance
 * @param {Array} abi - Contract ABI
 * @param {String} address - Contract address
 */
export const getContract = (abi, address) => {
  try {
    const contractAbi = Array.isArray(abi) ? abi : abi.abi;
    if (!address) throw new Error("Contract address is missing");

    const provider = getProvider();
    return new Contract(address, contractAbi, signer || provider);
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
      return "0";
    }

    const provider = getProvider();
    const balanceWei = await provider.getBalance(account);
    return formatEther(balanceWei);
  } catch (error) {
    return "0";
  }
};

/**
 * Extract readable message from Ethers errors
 */
export const extractSolidityError = (error) => {
  if (!error) return "Unknown error";
  if (error.reason) return error.reason;
  if (error.shortMessage) return error.shortMessage;
  if (error.data?.message) return error.data.message;
  if (error.message) return error.message;
  return String(error);
};

/**
 * Watch for account changes
 */
export const watchAccountChanges = (callback) => {
  try {
    const injectedProvider = detectProvider();
    if (injectedProvider) {
      injectedProvider.on("accountsChanged", (accounts) => {
        selectedAccount = accounts[0];
        signer = null;
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
    const injectedProvider = detectProvider();
    if (injectedProvider) {
      injectedProvider.on("chainChanged", (chainId) => {
        callback(parseInt(chainId, 16));
      });
    }
  } catch (error) {
    console.error("Failed to watch chain changes:", error);
  }
};
