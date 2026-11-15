
package com.example.demo.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "assets")
public class Asset {

    @Id
    @Column(length = 50)
    private String id;

    private String name;
    private String type;
    private String provider;
    private String region;
    private String operatingSystem;

    @Column(name = "asset_owner")
    private String owner;

    private String department;
    private String criticality;

    @Column(name = "patch_status")
    private String patchStatus;

    private Integer riskScore;
    private String ipAddress;
    private String environment;
    private Integer vulnerabilities;

    private LocalDateTime lastSeen;
    private LocalDateTime createdAt;

    public Asset() {
    }

    @PrePersist
    public void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (lastSeen == null) {
            lastSeen = LocalDateTime.now();
        }
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }

    public String getOperatingSystem() { return operatingSystem; }
    public void setOperatingSystem(String operatingSystem) {
        this.operatingSystem = operatingSystem;
    }

    public String getOwner() { return owner; }
    public void setOwner(String owner) { this.owner = owner; }

    public String getDepartment() { return department; }
    public void setDepartment(String department) {
        this.department = department;
    }

    public String getCriticality() { return criticality; }
    public void setCriticality(String criticality) {
        this.criticality = criticality;
    }

    public String getPatchStatus() { return patchStatus; }
    public void setPatchStatus(String patchStatus) {
        this.patchStatus = patchStatus;
    }

    public Integer getRiskScore() { return riskScore; }
    public void setRiskScore(Integer riskScore) {
        this.riskScore = riskScore;
    }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) {
        this.environment = environment;
    }

    public Integer getVulnerabilities() { return vulnerabilities; }
    public void setVulnerabilities(Integer vulnerabilities) {
        this.vulnerabilities = vulnerabilities;
    }

    public LocalDateTime getLastSeen() { return lastSeen; }
    public void setLastSeen(LocalDateTime lastSeen) {
        this.lastSeen = lastSeen;
    }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
