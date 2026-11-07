
import React from "react";

function AssetDetails({ asset, onClose, onEdit }) {
  if (!asset) return null;

  const details = [
    { label: "Asset ID", value: asset.id },
    { label: "Asset Name", value: asset.name },
    { label: "Asset Type", value: asset.type },
    { label: "Cloud Provider", value: asset.provider },
    { label: "Region", value: asset.region },
    { label: "Operating System", value: asset.operatingSystem },
    { label: "Owner", value: asset.owner },
    { label: "Department", value: asset.department },
    { label: "Environment", value: asset.environment },
    { label: "IP Address", value: asset.ipAddress },
    { label: "Criticality", value: asset.criticality },
    { label: "Patch Status", value: asset.patchStatus },
    { label: "Vulnerabilities", value: asset.vulnerabilities },
    { label: "Risk Score", value: `${asset.riskScore}/100` },
    { label: "Last Seen", value: asset.lastSeen },
    { label: "Created At", value: asset.createdAt },
  ];

  const getRiskLevel = (score) => {
    if (score >= 85) return "Critical";
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  };

  return (
    <div
      className="asset-modal-overlay"
      onClick={onClose}
    >
      <section
        className="asset-details-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-details-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="asset-details-header">
          <div>
            <span className="asset-details-eyebrow">
              CLOUD RESOURCE DETAILS
            </span>

            <h2 id="asset-details-title">
              {asset.name}
            </h2>

            <p>{asset.id}</p>
          </div>

          <button
            type="button"
            className="asset-modal-close"
            onClick={onClose}
            aria-label="Close asset details"
          >
            ×
          </button>
        </div>

        <div className="asset-details-risk">
          <div>
            <span>Asset Risk Score</span>
            <h3>{asset.riskScore}/100</h3>
            <strong className={getRiskLevel(asset.riskScore).toLowerCase()}>
              {getRiskLevel(asset.riskScore)} Risk
            </strong>
          </div>

          <div className="asset-details-risk-bar">
            <span
              style={{
                width: `${Math.min(
                  Math.max(asset.riskScore, 0),
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="asset-details-section">
          <h3>Asset Information</h3>

          <div className="asset-details-grid">
            {details.map((item) => (
              <div className="asset-detail-item" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value ?? "N/A"}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="asset-details-footer">
          <button
            type="button"
            className="asset-secondary-btn"
            onClick={onClose}
          >
            Close
          </button>

          <button
            type="button"
            className="asset-primary-btn"
            onClick={() => onEdit?.(asset)}
          >
            ✎ Edit Asset
          </button>
        </div>
      </section>
    </div>
  );
}

export default AssetDetails;
