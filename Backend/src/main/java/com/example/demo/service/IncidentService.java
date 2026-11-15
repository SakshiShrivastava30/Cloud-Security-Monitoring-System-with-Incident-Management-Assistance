
package com.example.demo.service;

import com.example.demo.entity.Alert;
import com.example.demo.entity.Incident;
import com.example.demo.repository.AlertRepository;
import com.example.demo.repository.IncidentRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Locale;

@Service
@Transactional
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final AlertRepository alertRepository;

    public IncidentService(
            IncidentRepository incidentRepository,
            AlertRepository alertRepository) {

        this.incidentRepository = incidentRepository;
        this.alertRepository = alertRepository;
    }

    // ==========================================
    // CREATE INCIDENT FROM EXISTING ALERT
    // ==========================================

    public Incident createFromAlert(Long alertId, Long createdByUserId) {

        Alert alert = alertRepository.findById(alertId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Alert not found"));

        if (incidentRepository.existsByAlertId(alertId)) {
            throw new IllegalStateException(
                    "An incident already exists for this alert");
        }

        Incident incident = new Incident();

        incident.setAlertId(alert.getId());
        incident.setTitle(alert.getTitle());
        incident.setDescription(alert.getDescription());

        String severity = alert.getSeverity() != null
                ? alert.getSeverity().name()
                : "MEDIUM";

        incident.setSeverity(severity);
        incident.setPriority(mapPriority(severity));

        incident.setStatus("OPEN");
        incident.setCreatedByUserId(createdByUserId);

        return incidentRepository.save(incident);
    }

    // ==========================================
    // CREATE INCIDENT MANUALLY
    // ==========================================

    public Incident createIncident(
            String title,
            String description,
            String priority,
            Long createdByUserId) {

        if (title == null || title.isBlank()) {
            throw new IllegalArgumentException(
                    "Incident title is required");
        }

        Incident incident = new Incident();

        incident.setTitle(title.trim());
        incident.setDescription(description);
        incident.setPriority(validatePriority(priority));
        incident.setStatus("OPEN");
        incident.setCreatedByUserId(createdByUserId);

        return incidentRepository.save(incident);
    }

    // ==========================================
    // GET INCIDENT BY ID
    // ==========================================

    @Transactional(readOnly = true)
    public Incident getIncident(Long id) {

        return incidentRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Incident not found"));
    }

    // ==========================================
    // GET ALL INCIDENTS WITH PAGINATION
    // ==========================================

    @Transactional(readOnly = true)
    public Page<Incident> getAllIncidents(int page, int size) {

        validatePagination(page, size);

        Pageable pageable = PageRequest.of(
                page,
                Math.min(size, 200),
                Sort.by(Sort.Direction.DESC, "createdAt")
        );

        return incidentRepository.findAllByOrderByCreatedAtDesc(pageable);
    }

    // ==========================================
    // GET INCIDENTS BY STATUS
    // ==========================================

    @Transactional(readOnly = true)
    public Page<Incident> getIncidentsByStatus(
            String status,
            int page,
            int size) {

        validatePagination(page, size);

        String validStatus = validateStatus(status);

        Pageable pageable = PageRequest.of(
                page,
                Math.min(size, 200)
        );

        return incidentRepository
                .findByStatusOrderByCreatedAtDesc(
                        validStatus,
                        pageable
                );
    }

    // ==========================================
    // ASSIGN INCIDENT TO ANALYST
    // ==========================================

    public Incident assignIncident(Long incidentId, Long analystId) {

        if (analystId == null) {
            throw new IllegalArgumentException(
                    "Analyst ID is required");
        }

        Incident incident = getIncident(incidentId);

        if ("RESOLVED".equals(incident.getStatus())
                || "CLOSED".equals(incident.getStatus())) {

            throw new IllegalStateException(
                    "Cannot assign a closed or resolved incident");
        }

        incident.setAssignedToUserId(analystId);

        return incidentRepository.save(incident);
    }

    // ==========================================
    // UPDATE INCIDENT STATUS
    // ==========================================

    public Incident updateStatus(Long incidentId, String status) {

        Incident incident = getIncident(incidentId);

        String newStatus = validateStatus(status);

        incident.setStatus(newStatus);

        if ("RESOLVED".equals(newStatus)) {
            incident.setResolvedAt(OffsetDateTime.now());
        } else if ("OPEN".equals(newStatus)
                || "IN_PROGRESS".equals(newStatus)) {
            incident.setResolvedAt(null);
        }

        return incidentRepository.save(incident);
    }

    // ==========================================
    // RESOLVE INCIDENT
    // ==========================================

    public Incident resolveIncident(
            Long incidentId,
            String resolutionNotes) {

        Incident incident = getIncident(incidentId);

        if ("RESOLVED".equals(incident.getStatus())) {
            throw new IllegalStateException(
                    "Incident is already resolved");
        }

        incident.setStatus("RESOLVED");
        incident.setResolutionNotes(resolutionNotes);
        incident.setResolvedAt(OffsetDateTime.now());

        return incidentRepository.save(incident);
    }

    // ==========================================
    // DELETE INCIDENT
    // ==========================================

    public void deleteIncident(Long incidentId) {

        Incident incident = getIncident(incidentId);

        incidentRepository.delete(incident);
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    private String mapPriority(String severity) {

        return switch (severity.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> "CRITICAL";
            case "HIGH" -> "HIGH";
            case "MEDIUM" -> "MEDIUM";
            default -> "LOW";
        };
    }

    private String validatePriority(String priority) {

        if (priority == null || priority.isBlank()) {
            return "MEDIUM";
        }

        String value = priority.toUpperCase(Locale.ROOT);

        if (!value.matches("LOW|MEDIUM|HIGH|CRITICAL")) {
            throw new IllegalArgumentException(
                    "Invalid priority");
        }

        return value;
    }

    private String validateStatus(String status) {

        if (status == null || status.isBlank()) {
            throw new IllegalArgumentException(
                    "Incident status is required");
        }

        String value = status.toUpperCase(Locale.ROOT);

        if (!value.matches("OPEN|IN_PROGRESS|RESOLVED|CLOSED")) {
            throw new IllegalArgumentException(
                    "Invalid incident status");
        }

        return value;
    }

    private void validatePagination(int page, int size) {

        if (page < 0 || size < 1) {
            throw new IllegalArgumentException(
                    "Invalid page or size");
        }
    }
}
