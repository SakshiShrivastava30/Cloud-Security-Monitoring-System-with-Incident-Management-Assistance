
package com.example.demo.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.entity.Playbook;
import com.example.demo.entity.PlaybookAction;
import com.example.demo.repository.PlaybookActionRepository;
import com.example.demo.repository.PlaybookRepository;

@Service
public class PlaybookActionService {

    private final PlaybookActionRepository actionRepository;
    private final PlaybookRepository playbookRepository;

    public PlaybookActionService(
            PlaybookActionRepository actionRepository,
            PlaybookRepository playbookRepository) {

        this.actionRepository = actionRepository;
        this.playbookRepository = playbookRepository;
    }

    public PlaybookAction createAction(Long playbookId, PlaybookAction action) {

        Playbook playbook = playbookRepository.findById(playbookId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Playbook not found"));

        // Validate action type
        if (action.getActionType() == null ||
                !action.getActionType().equalsIgnoreCase("NOTIFICATION")) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid action type. Supported type: NOTIFICATION");
        }

        // Validate action configuration
        if (action.getActionConfig() == null ||
                action.getActionConfig().trim().isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Action configuration cannot be empty");
        }
     // Validate action configuration length
        if (action.getActionConfig().trim().length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Action configuration cannot exceed 2000 characters");
        }

        // Validate execution order
        if (action.getExecutionOrder() == null ||
                action.getExecutionOrder() < 1) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Execution order must be at least 1");
        }
     // Check duplicate execution order
        if (actionRepository.existsByPlaybookIdAndExecutionOrder(
                playbookId, action.getExecutionOrder())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Execution order already exists for this playbook");
        }

        action.setActionType("NOTIFICATION");
        action.setPlaybook(playbook);

        return actionRepository.save(action);
    }

    public List<PlaybookAction> getActions(Long playbookId) {
        return actionRepository.findByPlaybookId(playbookId);
    }
}
