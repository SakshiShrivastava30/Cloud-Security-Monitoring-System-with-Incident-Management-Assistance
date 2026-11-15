
package com.example.demo.controller;

import com.example.demo.entity.Asset;
import com.example.demo.service.AssetService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/assets")
@CrossOrigin(origins = "http://localhost:5173")
public class AssetController {

    private final AssetService assetService;

    public AssetController(AssetService assetService) {
        this.assetService = assetService;
    }

    // GET: All assets
    @GetMapping
    public ResponseEntity<List<Asset>> getAllAssets() {
        return ResponseEntity.ok(assetService.getAllAssets());
    }

    // GET: Asset by ID
    @GetMapping("/{id}")
    public ResponseEntity<Asset> getAssetById(
            @PathVariable String id) {

        return ResponseEntity.ok(
                assetService.getAssetById(id)
        );
    }

    // POST: Add asset
    @PostMapping
    public ResponseEntity<Asset> addAsset(
            @RequestBody Asset asset) {

        Asset savedAsset = assetService.addAsset(asset);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(savedAsset);
    }

    // PUT: Update asset
    @PutMapping("/{id}")
    public ResponseEntity<Asset> updateAsset(
            @PathVariable String id,
            @RequestBody Asset asset) {

        return ResponseEntity.ok(
                assetService.updateAsset(id, asset)
        );
    }

    // DELETE: Delete asset
    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteAsset(
            @PathVariable String id) {

        assetService.deleteAsset(id);

        return ResponseEntity.ok(
                "Asset deleted successfully"
        );
    }
}
