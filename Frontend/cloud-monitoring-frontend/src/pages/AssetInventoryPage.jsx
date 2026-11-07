
import "../styles/asset-inventory.css";
import { useEffect, useMemo, useState } from "react";

import AssetOverview from "../components/asset-inventory/AssetOverview";
import AssetFilters from "../components/asset-inventory/AssetFilters";
import AssetTable from "../components/asset-inventory/AssetTable";
import AssetDetails from "../components/asset-inventory/AssetDetails";
import AddAssetModal from "../components/asset-inventory/AddAssetModal";

// Backend API URL
const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

// Common API request function
async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem("token");

  const headers = {
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorMessage = await response.text();

    throw new Error(
      errorMessage || `Request failed with status ${response.status}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  const responseText = await response.text();

  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

function AssetInventoryPage() {
  // Asset list
  const [assets, setAssets] = useState([]);

  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter states
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("All");
  const [type, setType] = useState("All");
  const [criticality, setCriticality] = useState("All");
  const [patchStatus, setPatchStatus] = useState("All");

  // Modal states
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [editingAsset, setEditingAsset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch assets from backend
  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError("");

      const data = await apiRequest("/api/assets");

      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching assets:", err);
      setError(err.message || "Unable to fetch assets.");
    } finally {
      setLoading(false);
    }
  };

  // Load assets when page opens
  useEffect(() => {
    fetchAssets();
  }, []);

  // Search and filters
  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        asset.name?.toLowerCase().includes(searchText) ||
        asset.id?.toLowerCase().includes(searchText) ||
        asset.owner?.toLowerCase().includes(searchText) ||
        asset.ipAddress?.toLowerCase().includes(searchText) ||
        asset.region?.toLowerCase().includes(searchText);

      const matchesProvider =
        provider === "All" || asset.provider === provider;

      const matchesType =
        type === "All" || asset.type === type;

      const matchesCriticality =
        criticality === "All" ||
        asset.criticality === criticality;

      const matchesPatchStatus =
        patchStatus === "All" ||
        asset.patchStatus === patchStatus;

      return (
        matchesSearch &&
        matchesProvider &&
        matchesType &&
        matchesCriticality &&
        matchesPatchStatus
      );
    });
  }, [
    assets,
    search,
    provider,
    type,
    criticality,
    patchStatus,
  ]);

  // Reset filters
  const handleResetFilters = () => {
    setSearch("");
    setProvider("All");
    setType("All");
    setCriticality("All");
    setPatchStatus("All");
  };

  // Open add modal
  const handleAddAsset = () => {
    setEditingAsset(null);
    setIsModalOpen(true);
  };

  // Open edit modal
  const handleEditAsset = (asset) => {
    setSelectedAsset(null);
    setEditingAsset(asset);
    setIsModalOpen(true);
  };

  // Add or update asset through backend
  const handleSaveAsset = async (assetData) => {
    try {
      setError("");

      if (editingAsset) {
        // Update existing asset
        const updatedAsset = await apiRequest(
          `/api/assets/${encodeURIComponent(editingAsset.id)}`,
          {
            method: "PUT",
            body: JSON.stringify(assetData),
          }
        );

        setAssets((previousAssets) =>
          previousAssets.map((asset) =>
            asset.id === editingAsset.id
              ? updatedAsset
              : asset
          )
        );

        setEditingAsset(null);
        setSelectedAsset(null);
      } else {
        // Add new asset
        const newAsset = await apiRequest("/api/assets", {
          method: "POST",
          body: JSON.stringify(assetData),
        });

        setAssets((previousAssets) => [
          newAsset,
          ...previousAssets,
        ]);
      }

      return true;
    } catch (err) {
      console.error("Error saving asset:", err);

      alert(`Unable to save asset: ${err.message}`);

      return false;
    }
  };

  // Delete asset through backend
  const handleDeleteAsset = async (assetId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this asset?"
    );

    if (!confirmDelete) return;

    try {
      setError("");

      await apiRequest(
        `/api/assets/${encodeURIComponent(assetId)}`,
        {
          method: "DELETE",
        }
      );

      setAssets((previousAssets) =>
        previousAssets.filter(
          (asset) => asset.id !== assetId
        )
      );

      if (selectedAsset?.id === assetId) {
        setSelectedAsset(null);
      }
    } catch (err) {
      console.error("Error deleting asset:", err);

      alert(`Unable to delete asset: ${err.message}`);
    }
  };

  // View asset details
  const handleViewAsset = (asset) => {
    setSelectedAsset(asset);
  };

  // Close add/edit modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAsset(null);
  };

  return (
    <div className="asset-inventory-page">

      {/* Page Header */}
      <div className="asset-page-header">
        <div>
          <p className="asset-page-eyebrow">
            CLOUD SECURITY / INVENTORY
          </p>

          <h1>Asset Inventory</h1>

          <p className="asset-page-description">
            Discover, monitor, and manage your cloud infrastructure
            assets from one centralized workspace.
          </p>
        </div>

        <button
          className="asset-add-button"
          onClick={handleAddAsset}
        >
          <span>+</span>
          Add New Asset
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="asset-empty-state">
          Loading assets from server...
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="asset-empty-state">
          <p>Backend connection error: {error}</p>

          <button
            className="asset-primary-btn"
            onClick={fetchAssets}
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Asset Content */}
      {!loading && !error && (
        <>
          <AssetOverview assets={assets} />

          <AssetFilters
            search={search}
            setSearch={setSearch}
            provider={provider}
            setProvider={setProvider}
            type={type}
            setType={setType}
            criticality={criticality}
            setCriticality={setCriticality}
            patchStatus={patchStatus}
            setPatchStatus={setPatchStatus}
            onReset={handleResetFilters}
          />

          <AssetTable
            assets={filteredAssets}
            onViewAsset={handleViewAsset}
            onEditAsset={handleEditAsset}
            onDeleteAsset={handleDeleteAsset}
          />

          <AssetDetails
            asset={selectedAsset}
            onClose={() => setSelectedAsset(null)}
            onEdit={handleEditAsset}
          />
        </>
      )}

      {/* Add / Edit Asset Modal */}
      <AddAssetModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveAsset}
        editingAsset={editingAsset}
      />

    </div>
  );
}

export default AssetInventoryPage;
