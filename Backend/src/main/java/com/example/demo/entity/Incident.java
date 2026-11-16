
package com.example.demo.entity;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDateTime;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "incidents")
public class Incident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Incident title is required")
    private String title;

    @Size(max = 2000, message = "Description cannot exceed 2000 characters")
    @Column(length = 2000)
    private String description;

    @NotBlank(message = "Incident severity is required")
    @Pattern(
        regexp = "LOW|MEDIUM|HIGH|CRITICAL",
        flags = Pattern.Flag.CASE_INSENSITIVE,
        message = "Severity must be LOW, MEDIUM, HIGH, or CRITICAL"
    )
    private String severity;

    private String status;

    @NotBlank(message = "Incident source is required")
    private String source;

    private LocalDateTime createdAt;

    public Incident() {
    }

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }

        if (status == null) {
            status = "OPEN";
        }
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
