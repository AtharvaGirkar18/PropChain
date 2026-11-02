import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createWeb3Modal, defaultConfig, useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from "@web3modal/ethers/react";
import { BrowserProvider, formatEther } from "ethers";

const projectId = process.env.REACT_APP_WC_PROJECT_ID || "1234567890abcdef";

const mainnet = {
  chainId: 1,
  name: "Ethereum",
  currency: "ETH",
  explorerUrl: "https://etherscan.io",
  rpcUrl: "https://cloudflare-eth.com"
};

const polygonAmoy = {
  chainId: 80002,
  name: "Polygon Amoy",
  currency: "MATIC",
  explorerUrl: "https://amoy.polygonscan.com",
  rpcUrl: "https://rpc-amoy.polygon.technology"
};

const localGanache = {
  chainId: 1337,
  name: "Local Ganache",
  currency: "ETH",
  explorerUrl: "",
  rpcUrl: "http://127.0.0.1:8545"
};

const sepolia = {
  chainId: 11155111,
  name: "Sepolia",
  currency: "ETH",
  explorerUrl: "https://sepolia.etherscan.io",
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com"
};

const metadata = {
  name: "PropChain",
  description: "Tokenized Real Estate Labs",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"]
};

// Call createWeb3Modal outside of any component
createWeb3Modal({
  ethersConfig: defaultConfig({ metadata, enableEIP6963: true, enableInjected: true }),
  chains: [mainnet, polygonAmoy, localGanache, sepolia],
  projectId,
  enableAnalytics: false 
});

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { open } = useWeb3Modal();

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);

  const refreshBalance = async (target = address) => {
    if (!target || !provider) {
      setBalance("0");
      return;
    }
    try {
      const rawBalance = await provider.getBalance(target);
      setBalance(formatEther(rawBalance));
    } catch (e) {
      setBalance("0");
    }
  };

  useEffect(() => {
    if (isConnected && walletProvider) {
      const initEthers = async () => {
        const _provider = new BrowserProvider(walletProvider);
        const _signer = await _provider.getSigner();
        setProvider(_provider);
        setSigner(_signer);
      };
      initEthers();
    } else {
      setProvider(null);
      setSigner(null);
      setBalance("0");
    }
  }, [isConnected, walletProvider]);

  // When provider is ready, fetch balance
  useEffect(() => {
    if (provider && address) {
      refreshBalance(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, address]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      await open();
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    await open({ view: 'Account' });
  };

  const value = useMemo(
    () => ({
      provider,
      signer,
      account: address,
      chainId,
      balance,
      isConnecting,
      isConnected,
      connect,
      disconnect,
      refreshBalance,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, signer, address, chainId, balance, isConnecting, isConnected, connect]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used inside WalletProvider");
  }
  return context;
}
