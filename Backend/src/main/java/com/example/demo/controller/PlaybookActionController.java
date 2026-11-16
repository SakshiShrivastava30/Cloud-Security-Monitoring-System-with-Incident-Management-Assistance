
package com.example.demo.controller;

import java.util.List;

import org.springframework.web.bind.annotation.*;

import com.example.demo.entity.PlaybookAction;
import com.example.demo.service.PlaybookActionService;

@RestController
@RequestMapping("/api/playbooks/{playbookId}/actions")
public class PlaybookActionController {

    private final PlaybookActionService actionService;

    public PlaybookActionController(
            PlaybookActionService actionService) {
        this.actionService = actionService;
    }

    // Create action
    @PostMapping
    public PlaybookAction createAction(
            @PathVariable Long playbookId,
            @RequestBody PlaybookAction action) {

        return actionService.createAction(playbookId, action);
    }

    // Get all actions for a playbook
    @GetMapping
    public List<PlaybookAction> getActions(
            @PathVariable Long playbookId) {

        return actionService.getActions(playbookId);
    }
}
