
import React from "react";

import {
  cloudProviders,
  assetTypes,
  criticalityLevels,
  patchStatuses,
} from "../../data/assetData";

function AssetFilters({
  search,
  setSearch,
  provider,
  setProvider,
  type,
  setType,
  criticality,
  setCriticality,
  patchStatus,
  setPatchStatus,
  onReset,
}) {
  return (
    <section className="asset-filters">
      <div className="asset-filter-header">
        <div>
          <h3>Asset Inventory</h3>
          <p>Search and filter your cloud infrastructure assets.</p>
        </div>

        <button
          type="button"
          className="asset-reset-btn"
          onClick={onReset}
        >
          ↻ Reset Filters
        </button>
      </div>

      <div className="asset-filter-controls">
        {/* Search */}
        <div className="asset-search-box">
          <span>⌕</span>

          <input
            type="search"
            placeholder="Search by asset name, ID, owner..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {/* Cloud Provider */}
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          aria-label="Filter by cloud provider"
        >
          <option value="All">All Providers</option>

          {cloudProviders.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {/* Asset Type */}
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Filter by asset type"
        >
          <option value="All">All Asset Types</option>

          {assetTypes.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {/* Criticality */}
        <select
          value={criticality}
          onChange={(event) => setCriticality(event.target.value)}
          aria-label="Filter by criticality"
        >
          <option value="All">All Criticality</option>

          {criticalityLevels.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        {/* Patch Status */}
        <select
          value={patchStatus}
          onChange={(event) => setPatchStatus(event.target.value)}
          aria-label="Filter by patch status"
        >
          <option value="All">All Patch Status</option>

          {patchStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

export default AssetFilters;
