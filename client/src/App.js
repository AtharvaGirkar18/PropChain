import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import {
  connectWallet,
  getAccount,
  getBalance,
  watchAccountChanges,
  watchChainChanges,
} from "./utils/web3";
import RegisterProperty from "./components/RegisterProperty";
import TransferOwnership from "./components/TransferOwnership";
import PropertyDetails from "./components/PropertyDetails";
import DisputePanel from "./components/DisputePanel";

function App() {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState("0");
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Contract addresses (update these after deployment)
  const LAND_REGISTRY_ADDRESS = "0x1a34839636dF0434CEeD7205982c7BC5BF669613";
  const PROPERTY_DISPUTE_ADDRESS = "0xEc0221773836852DBe1E75B2E276483f802ab50A";

  const updateBalance = useCallback(async (accountAddress) => {
    try {
      if (!accountAddress) {
        console.log("No account address provided");
        setBalance("0");
        return;
      }
      console.log("updateBalance called with:", accountAddress);
      const bal = await getBalance(accountAddress);
      console.log("Got balance:", bal, "Type:", typeof bal);

      // Ensure it's a valid number
      if (bal && bal !== "0" && bal !== "0.0") {
        console.log("Setting balance to:", bal);
        setBalance(bal.toString());
      } else {
        console.log("Balance returned was empty or zero");
        setBalance("0");
      }
    } catch (err) {
      console.error("Error getting balance:", err);
      setBalance("0");
    }
  }, []);

  const handleAccountChange = useCallback(
    (newAccount) => {
      setAccount(newAccount);
      updateBalance(newAccount);
    },
    [updateBalance],
  );

  const handleChainChange = useCallback((chainId) => {
    console.log("Chain changed to:", chainId);
    // You can add logic here to warn if not on correct network
    if (chainId !== 1337 && chainId !== 5777 && chainId !== 1) {
      setError("Please connect to Ganache network (localhost:7545)");
    } else {
      setError(null);
    }
  }, []);

  const initializeWallet = useCallback(async () => {
    const savedAccount = getAccount();
    console.log("Saved account on init:", savedAccount);
    if (savedAccount) {
      setAccount(savedAccount);
      setConnected(true);
      // Delay to ensure Web3 is ready
      setTimeout(() => {
        updateBalance(savedAccount);
      }, 1000);
    }
  }, [updateBalance]);

  useEffect(() => {
    // Initialize wallet connection on mount
    initializeWallet();

    // Watch for account and chain changes
    watchAccountChanges(handleAccountChange);
    watchChainChanges(handleChainChange);

    return () => {
      // Cleanup listeners if needed
    };
  }, [initializeWallet, handleAccountChange, handleChainChange]);

  const handleConnectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectWallet();

      if (result.success) {
        setAccount(result.account);
        setConnected(true);
        setSuccess(`Connected to ${result.account}`);
        // Delay balance fetch to ensure Web3 is ready
        setTimeout(() => {
          updateBalance(result.account);
        }, 500);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError("Failed to connect wallet: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetError = (msg) => {
    setError(msg);
  };

  const handleSetSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="App">
      <header className="header">
        <div className="header-content">
          <h1>🏠 Land Registry DApp</h1>
          <p className="subtitle">
            Blockchain-based Property Ownership & Dispute Management
          </p>
        </div>

        <div className="wallet-section">
          {!connected ? (
            <button
              className="btn btn-primary"
              onClick={handleConnectWallet}
              disabled={loading}
            >
              {loading ? "Connecting..." : "Connect MetaMask"}
            </button>
          ) : (
            <div className="wallet-info">
              <div className="account-display">
                <span className="label">Account:</span>
                <span className="value">
                  {account?.substring(0, 6)}...
                  {account?.substring(account.length - 4)}
                </span>
              </div>
              <div className="balance-display">
                <span className="label">Balance:</span>
                <span className="value">
                  {loading
                    ? "Loading..."
                    : balance && balance !== "0"
                      ? `${parseFloat(balance).toFixed(4)} ETH`
                      : "0.0000 ETH"}
                </span>
                <button
                  className="btn btn-small"
                  onClick={() => {
                    console.log("Refreshing balance for account:", account);
                    updateBalance(account);
                  }}
                  disabled={loading}
                  style={{
                    marginLeft: "0.5rem",
                    padding: "0.25rem 0.5rem",
                    fontSize: "0.8rem",
                  }}
                >
                  🔄
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {connected && (
        <main className="main-content">
          <div className="tabs">
            <button
              className={`tab-button ${activeTab === "register" ? "active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              📝 Register Property
            </button>
            <button
              className={`tab-button ${activeTab === "transfer" ? "active" : ""}`}
              onClick={() => setActiveTab("transfer")}
            >
              🔄 Transfer Ownership
            </button>
            <button
              className={`tab-button ${activeTab === "details" ? "active" : ""}`}
              onClick={() => setActiveTab("details")}
            >
              📋 Property Details
            </button>
            <button
              className={`tab-button ${activeTab === "disputes" ? "active" : ""}`}
              onClick={() => setActiveTab("disputes")}
            >
              ⚠️ Disputes
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "register" && (
              <RegisterProperty
                account={account}
                landRegistryAddress={LAND_REGISTRY_ADDRESS}
                onError={handleSetError}
                onSuccess={handleSetSuccess}
              />
            )}
            {activeTab === "transfer" && (
              <TransferOwnership
                account={account}
                landRegistryAddress={LAND_REGISTRY_ADDRESS}
                onError={handleSetError}
                onSuccess={handleSetSuccess}
              />
            )}
            {activeTab === "details" && (
              <PropertyDetails
                account={account}
                landRegistryAddress={LAND_REGISTRY_ADDRESS}
                onError={handleSetError}
              />
            )}
            {activeTab === "disputes" && (
              <DisputePanel
                account={account}
                landRegistryAddress={LAND_REGISTRY_ADDRESS}
                propertyDisputeAddress={PROPERTY_DISPUTE_ADDRESS}
                onError={handleSetError}
                onSuccess={handleSetSuccess}
              />
            )}
          </div>
        </main>
      )}

      {!connected && (
        <main className="main-content">
          <div className="welcome-message">
            <h2>👋 Welcome to Land Registry DApp</h2>
            <p>
              Connect your MetaMask wallet to manage properties and disputes.
            </p>
            <div className="setup-info">
              <h3>Setup Instructions:</h3>
              <ol>
                <li>
                  Open Ganache and start the development network on port 7545
                </li>
                <li>
                  Import a test account into MetaMask using its private key
                </li>
                <li>Connect MetaMask to localhost:7545 (Ganache RPC)</li>
                <li>
                  Deploy contracts using:{" "}
                  <code>truffle migrate --network development</code>
                </li>
                <li>Update contract addresses in App.js</li>
                <li>Click "Connect MetaMask" above</li>
              </ol>
            </div>
          </div>
        </main>
      )}

      <footer className="footer">
        <p>
          Land Registry DApp © 2024 | Built with Solidity, Truffle, React &
          Web3.js
        </p>
      </footer>
    </div>
  );
}

export default App;
