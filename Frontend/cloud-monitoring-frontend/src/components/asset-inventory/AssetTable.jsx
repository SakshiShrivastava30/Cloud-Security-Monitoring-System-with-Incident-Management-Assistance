
import React from "react";

function AssetTable({
  assets = [],
  onViewAsset,
  onEditAsset,
  onDeleteAsset,
}) {
  const getRiskLevel = (score = 0) => {
    if (score >= 85) return "Critical";
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  };

  return (
    <section className="asset-table-section">
      <div className="asset-table-heading">
        <div>
          <h3>Registered Assets</h3>
          <p>
            Complete overview of your cloud infrastructure resources.
          </p>
        </div>

        <span className="asset-record-count">
          {assets.length} Records
        </span>
      </div>

      <div className="asset-table-wrapper">
        <table className="asset-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Type</th>
              <th>Provider</th>
              <th>Owner</th>
              <th>Criticality</th>
              <th>Risk Score</th>
              <th>Patch Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {assets.length > 0 ? (
              assets.map((asset) => {
                const riskScore = Number(asset.riskScore) || 0;

                return (
                  <tr key={asset.id}>
                    <td>
                      <div className="asset-name-cell">
                        <strong>{asset.name}</strong>
                        <small>{asset.id}</small>
                      </div>
                    </td>

                    <td>{asset.type}</td>

                    <td>
                      <span
                        className={`asset-provider ${
                          asset.provider?.toLowerCase() || ""
                        }`}
                      >
                        {asset.provider || "-"}
                      </span>
                    </td>

                    <td>{asset.owner || "-"}</td>

                    <td>
                      <span
                        className={`asset-status ${
                          asset.criticality?.toLowerCase() || ""
                        }`}
                      >
                        {asset.criticality || "-"}
                      </span>
                    </td>

                    <td>
                      <div className="asset-risk-cell">
                        <strong>{riskScore}</strong>

                        <div className="asset-risk-bar">
                          <span
                            className={getRiskLevel(riskScore).toLowerCase()}
                            style={{
                              width: `${Math.min(
                                Math.max(riskScore, 0),
                                100
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`asset-status ${
                          asset.patchStatus?.toLowerCase() || ""
                        }`}
                      >
                        {asset.patchStatus || "-"}
                      </span>
                    </td>

                    <td>
                      <div className="asset-action-buttons">
                        <button
                          type="button"
                          title="View asset"
                          aria-label={`View ${asset.name}`}
                          onClick={() => onViewAsset?.(asset)}
                        >
                          ◉
                        </button>

                        <button
                          type="button"
                          title="Edit asset"
                          aria-label={`Edit ${asset.name}`}
                          onClick={() => onEditAsset?.(asset)}
                        >
                          ✎
                        </button>

                        <button
                          type="button"
                          title="Delete asset"
                          aria-label={`Delete ${asset.name}`}
                          onClick={() => onDeleteAsset?.(asset.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="asset-empty-state">
                  <div>▣</div>
                  <strong>No assets found</strong>
                  <p>
                    Try changing your search or filter criteria.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default AssetTable;
