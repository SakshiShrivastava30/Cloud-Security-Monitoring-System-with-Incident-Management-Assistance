
package com.example.demo.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.example.demo.repository.PlaybookExecutionRepository;

import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.stereotype.Service;
import com.example.demo.entity.Playbook;
import com.example.demo.repository.PlaybookRepository;
import com.example.demo.entity.PlaybookExecution;
import com.example.demo.service.PlaybookExecutionService;

import com.example.demo.entity.Incident;
import com.example.demo.repository.IncidentRepository;

@Service
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final PlaybookRepository playbookRepository;
    private final PlaybookExecutionService executionService;
    private final PlaybookExecutionRepository playbookExecutionRepository;

    private static final Logger logger =
            LoggerFactory.getLogger(IncidentService.class);

    public IncidentService(
            IncidentRepository incidentRepository,
            PlaybookRepository playbookRepository,
            PlaybookExecutionService executionService,
            PlaybookExecutionRepository playbookExecutionRepository) {

        this.incidentRepository = incidentRepository;
        this.playbookRepository = playbookRepository;
        this.executionService = executionService;
        this.playbookExecutionRepository = playbookExecutionRepository;
    }


public Incident createIncident(Incident incident) {

    // 1. Find matching active playbooks before saving
    List<Playbook> playbooks =
            playbookRepository.findBySeverityIgnoreCaseAndStatusIgnoreCase(
                    incident.getSeverity(), "ACTIVE");

    // 2. Prevent ambiguous playbook selection
    if (playbooks.size() > 1) {
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Multiple active playbooks found for severity: "
                        + incident.getSeverity());
    }

    // 3. Save incident
    Incident savedIncident = incidentRepository.save(incident);

    // 4. No matching active playbook
    if (playbooks.isEmpty()) {
        savedIncident.setStatus("OPEN");
        return incidentRepository.save(savedIncident);
    }

    // 5. Execute the matching playbook
    try {
        Playbook playbook = playbooks.get(0);

        PlaybookExecution execution =
                executionService.executePlaybook(
                        playbook.getId(), savedIncident.getId());

        // 6. Update incident status
        if ("SUCCESS".equalsIgnoreCase(execution.getExecutionStatus())) {
            savedIncident.setStatus("IN_PROGRESS");
        }

    } catch (Exception e) {

        logger.error(
                "Playbook execution failed for incident ID: {}",
                savedIncident.getId(),
                e);

        savedIncident.setStatus("OPEN");
    }

    return incidentRepository.save(savedIncident);
}


 // Update incident status
    public Incident updateIncidentStatus(Long id, String status) {

        Incident incident = incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Incident not found"));

        Set<String> validStatuses = Set.of(
                "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED");

        if (status == null ||
                !validStatuses.contains(status.trim().toUpperCase())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid status. Allowed: OPEN, IN_PROGRESS, RESOLVED, CLOSED");
        }

        incident.setStatus(status.trim().toUpperCase());

        return incidentRepository.save(incident);
    }

    // Get all incidents
    public List<Incident> getAllIncidents() {
        return incidentRepository.findAll();
    }


 // Get incident by ID
    public Incident getIncidentById(Long id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Incident not found"));
    }


public void deleteIncident(Long id) {

    Incident incident = incidentRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Incident not found"));

    // Check whether execution history exists
    boolean hasExecutions =
            playbookExecutionRepository.existsByIncident_Id(id);

    if (hasExecutions) {
        throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Cannot delete incident because execution history exists.");
    }

    incidentRepository.delete(incident);
}

}
