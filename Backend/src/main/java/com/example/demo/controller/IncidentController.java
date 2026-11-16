
package com.example.demo.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.demo.entity.Incident;
import com.example.demo.entity.PlaybookExecution;
import com.example.demo.service.IncidentService;
import com.example.demo.service.PlaybookExecutionService;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;
    private final PlaybookExecutionService executionService;

    public IncidentController(
            IncidentService incidentService,
            PlaybookExecutionService executionService) {

        this.incidentService = incidentService;
        this.executionService = executionService;
    }

    // Create a new incident with validation
    @PostMapping
    public Incident createIncident(@Valid @RequestBody Incident incident) {
        return incidentService.createIncident(incident);
    }

    // Get all incidents
    @GetMapping
    public List<Incident> getAllIncidents() {
        return incidentService.getAllIncidents();
    }

    // Get an incident by ID
    @GetMapping("/{id}")
    public Incident getIncidentById(@PathVariable Long id) {
        return incidentService.getIncidentById(id);
    }

    // Get execution history for an incident
    @GetMapping("/{incidentId}/executions")
    public List<PlaybookExecution> getExecutionsByIncident(
            @PathVariable Long incidentId) {

        // Verify that the incident exists
        incidentService.getIncidentById(incidentId);

        return executionService.getExecutionsByIncident(incidentId);
    }

    // Delete an incident
    @DeleteMapping("/{id}")
    public String deleteIncident(@PathVariable Long id) {
        incidentService.deleteIncident(id);
        return "Incident deleted successfully";
    }

    // Update incident status
    @PutMapping("/{id}/status")
    public Incident updateIncidentStatus(
            @PathVariable Long id,
            @RequestParam String status) {

        return incidentService.updateIncidentStatus(id, status);
    }
}
