
import { useEffect, useState } from "react";

import {
  assetTypes,
  cloudProviders,
  criticalityLevels,
  patchStatuses,
  environments,
} from "../../data/assetData";

const initialFormData = {
  name: "",
  type: "Server",
  provider: "AWS",
  region: "",
  operatingSystem: "",
  owner: "",
  department: "",
  criticality: "Medium",
  patchStatus: "Updated",
  riskScore: 0,
  ipAddress: "",
  environment: "Production",
  vulnerabilities: 0,
};

function AddAssetModal({
  isOpen,
  onClose,
  onSave,
  editingAsset = null,
}) {
  const [formData, setFormData] = useState(initialFormData);
  const [saving, setSaving] = useState(false);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData(
        editingAsset
          ? { ...initialFormData, ...editingAsset }
          : { ...initialFormData }
      );

      setSaving(false);
    }
  }, [isOpen, editingAsset]);

  if (!isOpen) return null;

  // Handle form inputs
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]:
        name === "riskScore" || name === "vulnerabilities"
          ? Number(value)
          : value,
    }));
  };

  // Submit form
  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    const assetPayload = editingAsset
      ? { ...editingAsset, ...formData }
      : { ...formData };

    try {
      setSaving(true);

      const success = await onSave(assetPayload);

      if (success) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  // Render select fields
  const renderSelect = (label, name, options) => (
    <div className="asset-form-group">
      <label htmlFor={name}>{label}</label>

      <select
        id={name}
        name={name}
        value={formData[name]}
        onChange={handleChange}
        required
        disabled={saving}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div
      className="asset-modal-overlay"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="asset-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-form-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="asset-details-header">
          <div>
            <p className="asset-details-eyebrow">
              ASSET MANAGEMENT
            </p>

            <h2 id="asset-form-title">
              {editingAsset ? "Edit Asset" : "Add New Asset"}
            </h2>

            <p>
              Enter the details of your cloud infrastructure asset.
            </p>
          </div>

          <button
            type="button"
            className="asset-modal-close"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        {/* Asset Form */}
        <form onSubmit={handleSubmit}>
          <div className="asset-form-grid">

            <div className="asset-form-group">
              <label htmlFor="name">Asset Name *</label>

              <input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Production API Server"
                required
                disabled={saving}
              />
            </div>

            {renderSelect(
              "Asset Type",
              "type",
              assetTypes
            )}

            {renderSelect(
              "Cloud Provider",
              "provider",
              cloudProviders
            )}

            <div className="asset-form-group">
              <label htmlFor="region">Region *</label>

              <input
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                placeholder="e.g. ap-south-1"
                required
                disabled={saving}
              />
            </div>

            <div className="asset-form-group">
              <label htmlFor="operatingSystem">
                Operating System
              </label>

              <input
                id="operatingSystem"
                name="operatingSystem"
                value={formData.operatingSystem}
                onChange={handleChange}
                placeholder="e.g. Ubuntu 24.04"
                disabled={saving}
              />
            </div>

            <div className="asset-form-group">
              <label htmlFor="ipAddress">IP Address</label>

              <input
                id="ipAddress"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleChange}
                placeholder="e.g. 192.168.1.10"
                disabled={saving}
              />
            </div>

            <div className="asset-form-group">
              <label htmlFor="owner">Asset Owner *</label>

              <input
                id="owner"
                name="owner"
                value={formData.owner}
                onChange={handleChange}
                placeholder="e.g. Rahul Sharma"
                required
                disabled={saving}
              />
            </div>

            <div className="asset-form-group">
              <label htmlFor="department">Department</label>

              <input
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g. Engineering"
                disabled={saving}
              />
            </div>

            {renderSelect(
              "Criticality",
              "criticality",
              criticalityLevels
            )}

            {renderSelect(
              "Patch Status",
              "patchStatus",
              patchStatuses
            )}

            {renderSelect(
              "Environment",
              "environment",
              environments
            )}

            <div className="asset-form-group">
              <label htmlFor="riskScore">
                Risk Score (0–100)
              </label>

              <input
                id="riskScore"
                name="riskScore"
                type="number"
                min="0"
                max="100"
                value={formData.riskScore}
                onChange={handleChange}
                required
                disabled={saving}
              />
            </div>

            <div className="asset-form-group">
              <label htmlFor="vulnerabilities">
                Vulnerabilities
              </label>

              <input
                id="vulnerabilities"
                name="vulnerabilities"
                type="number"
                min="0"
                value={formData.vulnerabilities}
                onChange={handleChange}
                required
                disabled={saving}
              />
            </div>

          </div>

          {/* Form Actions */}
          <div className="asset-form-actions">
            <button
              type="button"
              className="asset-secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="asset-primary-btn"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingAsset
                  ? "Save Changes"
                  : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddAssetModal;
