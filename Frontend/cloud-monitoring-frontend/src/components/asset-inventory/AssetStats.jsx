
import React from "react";

function AssetStats({ assets = [] }) {
  const totalAssets = assets.length;

  const criticalAssets = assets.filter(
    (asset) => asset.criticality === "Critical"
  ).length;

  const unpatchedAssets = assets.filter(
    (asset) => asset.patchStatus === "Outdated"
  ).length;

  const highRiskAssets = assets.filter(
    (asset) => asset.riskScore >= 70
  ).length;

  const stats = [
    {
      title: "Total Assets",
      value: totalAssets,
      icon: "▣",
      color: "cyan",
      description: "Registered cloud resources",
    },
    {
      title: "Critical Assets",
      value: criticalAssets,
      icon: "⚠",
      color: "red",
      description: "Require priority attention",
    },
    {
      title: "Unpatched Assets",
      value: unpatchedAssets,
      icon: "◈",
      color: "orange",
      description: "Outdated security patches",
    },
    {
      title: "High-Risk Assets",
      value: highRiskAssets,
      icon: "⬡",
      color: "purple",
      description: "Risk score of 70 or above",
    },
  ];

  return (
    <section className="asset-stats-grid">
      {stats.map((stat) => (
        <article
          className={`asset-stat-card ${stat.color}`}
          key={stat.title}
        >
          <div className="asset-stat-header">
            <span className="asset-stat-title">
              {stat.title}
            </span>

            <span className="asset-stat-icon">
              {stat.icon}
            </span>
          </div>

          <h2 className="asset-stat-value">
            {stat.value}
          </h2>

          <p className="asset-stat-description">
            {stat.description}
          </p>
        </article>
      ))}
    </section>
  );
}

export default AssetStats;
