
package com.example.demo.service;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.entity.Incident;
import com.example.demo.entity.Playbook;
import com.example.demo.entity.PlaybookAction;
import com.example.demo.entity.PlaybookExecution;
import com.example.demo.entity.PlaybookActionExecution;

import com.example.demo.repository.IncidentRepository;
import com.example.demo.repository.PlaybookRepository;
import com.example.demo.repository.PlaybookActionRepository;
import com.example.demo.repository.PlaybookExecutionRepository;
import com.example.demo.repository.PlaybookActionExecutionRepository;

@Service
public class PlaybookExecutionService {

    private final IncidentRepository incidentRepository;
    private final PlaybookRepository playbookRepository;
    private final PlaybookActionRepository actionRepository;
    private final PlaybookExecutionRepository executionRepository;
    private final PlaybookActionExecutionRepository actionExecutionRepository;

    public PlaybookExecutionService(
            PlaybookRepository playbookRepository,
            PlaybookActionRepository actionRepository,
            PlaybookExecutionRepository executionRepository,
            PlaybookActionExecutionRepository actionExecutionRepository,
            IncidentRepository incidentRepository) {

        this.playbookRepository = playbookRepository;
        this.actionRepository = actionRepository;
        this.executionRepository = executionRepository;
        this.actionExecutionRepository = actionExecutionRepository;
        this.incidentRepository = incidentRepository;
    }

    // Execute a playbook
    public PlaybookExecution executePlaybook(Long playbookId, Long incidentId) {

        // 1. Find playbook
        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Playbook not found"));

        // 2. Check whether playbook is ACTIVE
        if (!"ACTIVE".equalsIgnoreCase(playbook.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Playbook is not active");
        }

        // 3. Get actions belonging to the playbook
        List<PlaybookAction> actions =
                actionRepository.findByPlaybookId(playbookId);

        // 4. Check whether actions exist
        if (actions.isEmpty()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot execute playbook without actions");
        }

        // 5. Sort actions by execution order
        actions.sort(Comparator.comparing(
                PlaybookAction::getExecutionOrder,
                Comparator.nullsLast(Comparator.naturalOrder())
        ));

        // 6. Create execution record
        PlaybookExecution execution = new PlaybookExecution();

        execution.setPlaybook(playbook);

        // 7. Associate incident if incident ID is provided
        if (incidentId != null) {

            Incident incident = incidentRepository.findById(incidentId)
                    .orElseThrow(() -> new ResponseStatusException(
                            HttpStatus.NOT_FOUND,
                            "Incident not found"));

            execution.setIncident(incident);
        }

        execution.setExecutionStatus("RUNNING");
        execution.setStartedAt(LocalDateTime.now());

        executionRepository.save(execution);

        // 8. Execute actions one by one
        StringBuilder result = new StringBuilder();

        boolean failed = false;

        for (PlaybookAction action : actions) {

            PlaybookActionExecution actionExecution =
                    new PlaybookActionExecution();

            actionExecution.setExecution(execution);
            actionExecution.setAction(action);
            actionExecution.setStartedAt(LocalDateTime.now());
            actionExecution.setExecutionStatus("RUNNING");

            try {

                String actionResult;

                // 9. Execute notification action
                if ("NOTIFICATION".equalsIgnoreCase(action.getActionType())) {

                    actionResult = "Notification simulated: "
                            + action.getActionConfig();

                    System.out.println(actionResult);

                } else {

                    throw new RuntimeException(
                            "Unsupported action type: "
                                    + action.getActionType());
                }

                actionExecution.setExecutionStatus("SUCCESS");
                actionExecution.setExecutionResult(actionResult);

            } catch (Exception e) {

                failed = true;

                actionExecution.setExecutionStatus("FAILED");
                actionExecution.setExecutionResult(e.getMessage());
            }

            // 10. Record action completion time
            actionExecution.setCompletedAt(LocalDateTime.now());

            // 11. Save individual action execution
            actionExecutionRepository.save(actionExecution);

            // 12. Add action result to overall execution result
            result.append(action.getActionType())
                    .append(": ")
                    .append(actionExecution.getExecutionResult())
                    .append("\n");
        }

        // 13. Update overall execution status
        execution.setExecutionStatus(failed ? "FAILED" : "SUCCESS");

        execution.setExecutionResult(result.toString());

        execution.setCompletedAt(LocalDateTime.now());

        // 14. Save and return final execution record
        return executionRepository.save(execution);
    }

    // Get execution history for a playbook
    public List<PlaybookExecution> getExecutionHistory(Long playbookId) {

        if (!playbookRepository.existsById(playbookId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Playbook not found");
        }

        return executionRepository.findByPlaybookId(playbookId);
    }

    // Get execution history for an incident
    public List<PlaybookExecution> getExecutionsByIncident(Long incidentId) {

        if (!incidentRepository.existsById(incidentId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Incident not found");
        }

        return executionRepository.findByIncident_Id(incidentId);
    }

    // Get individual action execution history
    public List<PlaybookActionExecution> getActionExecutionHistory(
            Long executionId) {

        if (!executionRepository.existsById(executionId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Execution record not found");
        }

        return actionExecutionRepository.findByExecutionId(executionId);
    }
}
