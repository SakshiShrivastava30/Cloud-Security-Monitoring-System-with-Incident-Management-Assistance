
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#22c55e",
};

function AssetRiskChart({ assets = [] }) {
  const riskData = [
    {
      name: "Critical",
      value: assets.filter((asset) => asset.riskScore >= 85).length,
    },
    {
      name: "High",
      value: assets.filter(
        (asset) => asset.riskScore >= 70 && asset.riskScore < 85
      ).length,
    },
    {
      name: "Medium",
      value: assets.filter(
        (asset) => asset.riskScore >= 40 && asset.riskScore < 70
      ).length,
    },
    {
      name: "Low",
      value: assets.filter((asset) => asset.riskScore < 40).length,
    },
  ];

  const totalAssets = assets.length;

  return (
    <section className="asset-risk-chart-section">
      <div className="asset-chart-header">
        <div>
          <h3>Asset Risk Distribution</h3>
          <p>Breakdown of assets based on their risk scores</p>
        </div>

        <span className="asset-chart-total">
          {totalAssets} Assets
        </span>
      </div>

      {totalAssets === 0 ? (
        <div className="asset-chart-empty">
          No asset data available
        </div>
      ) : (
        <div className="asset-chart-content">
          <div className="asset-chart-visual">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={riskData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {riskData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={COLORS[entry.name]}
                    />
                  ))}
                </Pie>

                <Tooltip />
                <Legend verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="asset-risk-legend">
            {riskData.map((item) => (
              <div className="asset-risk-legend-item" key={item.name}>
                <div className="asset-risk-legend-label">
                  <span
                    className="asset-risk-dot"
                    style={{ backgroundColor: COLORS[item.name] }}
                  />
                  <span>{item.name} Risk</span>
                </div>

                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default AssetRiskChart;
