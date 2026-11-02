import React, { useState } from "react";
import RegisterProperty from "../components/RegisterProperty";
import TransferOwnership from "../components/TransferOwnership";
import PropertyDetails from "../components/PropertyDetails";

const ADMIN_TABS = [
  { id: "register", label: "Register" },
  { id: "transfer", label: "Transfer" },
  { id: "details", label: "Details" },
];

export default function Admin({
  account,
  landRegistryAddress,
  propertyTokenFactoryAddress,
  onError,
  onSuccess,
  onMutate,
}) {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <section className="panel">
      <h2>Admin Workspace</h2>
      <p className="panel-note">
        Legacy property operations remain available and now power the PropChain
        base asset layer.
      </p>

      <div className="inline-tabs">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "register" && (
        <RegisterProperty
          account={account}
          landRegistryAddress={landRegistryAddress}
          propertyTokenFactoryAddress={propertyTokenFactoryAddress}
          onError={onError}
          onSuccess={(msg) => {
            onSuccess(msg);
            onMutate();
          }}
        />
      )}

      {activeTab === "transfer" && (
        <TransferOwnership
          account={account}
          landRegistryAddress={landRegistryAddress}
          onError={onError}
          onSuccess={(msg) => {
            onSuccess(msg);
            onMutate();
          }}
        />
      )}

      {activeTab === "details" && (
        <PropertyDetails
          account={account}
          landRegistryAddress={landRegistryAddress}
          onError={onError}
        />
      )}
    </section>
  );
}
