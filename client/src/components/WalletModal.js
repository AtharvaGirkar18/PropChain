import React from "react";

export default function WalletModal() {
  return (
    <div className="wallet-modal-wrapper">
      {/* 
        Web3Modal v3 provides this custom web component out of the box. 
        It automatically handles connecting, displaying address/balance, 
        and supports theming.
      */}
      <w3m-button />
    </div>
  );
}
