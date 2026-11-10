
import AssetStats from "./AssetStats";
import AssetRiskChart from "./AssetRiskChart";

function AssetOverview({ assets = [] }) {
  return (
    <section className="asset-overview">
      <div className="asset-overview-header">
        <div>
          <h2>Asset Overview</h2>
          <p>
            Monitor your cloud infrastructure assets and their security posture.
          </p>
        </div>

        <div className="asset-overview-count">
          <span className="asset-overview-count-dot"></span>
          {assets.length} Total Assets
        </div>
      </div>

      {/* Asset statistics cards */}
      <AssetStats assets={assets} />

      {/* Asset risk distribution chart */}
      <div className="asset-overview-chart">
        <AssetRiskChart assets={assets} />
      </div>
    </section>
  );
}

export default AssetOverview;
