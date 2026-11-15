
package com.example.demo.service;

import com.example.demo.entity.Asset;
import com.example.demo.repository.AssetRepository;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class AssetService {

    private final AssetRepository assetRepository;

    public AssetService(AssetRepository assetRepository) {
        this.assetRepository = assetRepository;
    }

    // Get all assets
    public List<Asset> getAllAssets() {
        return assetRepository.findAll();
    }

    // Get asset by ID
    public Asset getAssetById(String id) {
        return assetRepository.findById(id)
                .orElseThrow(() ->
                        new RuntimeException("Asset not found: " + id));
    }

    // Add new asset
    public Asset addAsset(Asset asset) {

        if (asset.getId() == null || asset.getId().isBlank()) {
            asset.setId(
                    "AST-" + UUID.randomUUID()
                            .toString()
                            .substring(0, 8)
                            .toUpperCase()
            );
        }

        asset.setCreatedAt(LocalDateTime.now());
        asset.setLastSeen(LocalDateTime.now());

        return assetRepository.save(asset);
    }

    // Update existing asset
    public Asset updateAsset(String id, Asset updatedAsset) {

        Asset existingAsset = getAssetById(id);

        existingAsset.setName(updatedAsset.getName());
        existingAsset.setType(updatedAsset.getType());
        existingAsset.setProvider(updatedAsset.getProvider());
        existingAsset.setRegion(updatedAsset.getRegion());
        existingAsset.setOperatingSystem(
                updatedAsset.getOperatingSystem()
        );
        existingAsset.setOwner(updatedAsset.getOwner());
        existingAsset.setDepartment(updatedAsset.getDepartment());
        existingAsset.setCriticality(updatedAsset.getCriticality());
        existingAsset.setPatchStatus(updatedAsset.getPatchStatus());
        existingAsset.setRiskScore(updatedAsset.getRiskScore());
        existingAsset.setIpAddress(updatedAsset.getIpAddress());
        existingAsset.setEnvironment(updatedAsset.getEnvironment());
        existingAsset.setVulnerabilities(
                updatedAsset.getVulnerabilities()
        );

        return assetRepository.save(existingAsset);
    }

    // Delete asset
    public void deleteAsset(String id) {

        Asset asset = getAssetById(id);

        assetRepository.delete(asset);
    }
}
