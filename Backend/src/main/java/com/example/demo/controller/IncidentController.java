
package com.example.demo.controller;

import com.example.demo.entity.Incident;
import com.example.demo.service.IncidentService;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;

    public IncidentController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    // ==========================================
    // GET ALL INCIDENTS
    // ==========================================

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST', 'VIEWER')")
    public ResponseEntity<?> getAllIncidents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {

        if (status != null && !status.isBlank()) {
            return ResponseEntity.ok(
                    incidentService.getIncidentsByStatus(
                            status, page, size
                    )
            );
        }

        return ResponseEntity.ok(
                incidentService.getAllIncidents(page, size)
        );
    }

    // ==========================================
    // GET INCIDENT BY ID
    // ==========================================

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST', 'VIEWER')")
    public ResponseEntity<Incident> getIncident(
            @PathVariable Long id) {

        return ResponseEntity.ok(
                incidentService.getIncident(id)
        );
    }

    // ==========================================
    // CREATE INCIDENT MANUALLY
    // ==========================================

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> createIncident(
            @RequestBody CreateIncidentRequest request) {

        Incident incident = incidentService.createIncident(
                request.title(),
                request.description(),
                request.priority(),
                null
        );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message", "Incident created successfully",
                        "incident", incident
                ));
    }

    // ==========================================
    // CREATE INCIDENT FROM ALERT
    // ==========================================

    @PostMapping("/from-alert/{alertId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> createFromAlert(
            @PathVariable Long alertId) {

        Incident incident = incidentService.createFromAlert(
                alertId,
                null
        );

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of(
                        "message", "Incident created from alert successfully",
                        "incident", incident
                ));
    }

    // ==========================================
    // ASSIGN INCIDENT TO ANALYST
    // ==========================================

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> assignIncident(
            @PathVariable Long id,
            @RequestBody AssignIncidentRequest request) {

        Incident incident = incidentService.assignIncident(
                id,
                request.assignedToUserId()
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Incident assigned successfully",
                        "incident", incident
                )
        );
    }

    // ==========================================
    // UPDATE INCIDENT STATUS
    // ==========================================

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody UpdateStatusRequest request) {

        Incident incident = incidentService.updateStatus(
                id,
                request.status()
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Incident status updated successfully",
                        "incident", incident
                )
        );
    }

    // ==========================================
    // RESOLVE INCIDENT
    // ==========================================

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> resolveIncident(
            @PathVariable Long id,
            @RequestBody ResolveIncidentRequest request) {

        Incident incident = incidentService.resolveIncident(
                id,
                request.resolutionNotes()
        );

        return ResponseEntity.ok(
                Map.of(
                        "message", "Incident resolved successfully",
                        "incident", incident
                )
        );
    }

    // ==========================================
    // DELETE INCIDENT
    // ==========================================

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteIncident(
            @PathVariable Long id) {

        incidentService.deleteIncident(id);

        return ResponseEntity.ok(
                Map.of("message", "Incident deleted successfully")
        );
    }

    // ==========================================
    // REQUEST DTOs
    // ==========================================

    public record CreateIncidentRequest(
            String title,
            String description,
            String priority
    ) {}

    public record AssignIncidentRequest(
            Long assignedToUserId
    ) {}

    public record UpdateStatusRequest(
            String status
    ) {}

    public record ResolveIncidentRequest(
            String resolutionNotes
    ) {}

    // ==========================================
    // ERROR HANDLING
    // ==========================================

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleBadRequest(
            IllegalArgumentException exception) {

        return ResponseEntity.badRequest()
                .body(Map.of("error", exception.getMessage()));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<?> handleConflict(
            IllegalStateException exception) {

        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("error", exception.getMessage()));
    }
}

