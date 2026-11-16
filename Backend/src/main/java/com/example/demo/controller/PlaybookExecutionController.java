
package com.example.demo.controller;

import java.util.List;
import com.example.demo.entity.PlaybookActionExecution;

import org.springframework.web.bind.annotation.*;

import com.example.demo.entity.PlaybookExecution;
import com.example.demo.service.PlaybookExecutionService;

@RestController
@RequestMapping("/api/playbooks")
public class PlaybookExecutionController {

    private final PlaybookExecutionService executionService;

    public PlaybookExecutionController(
            PlaybookExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping("/{playbookId}/execute")
    public PlaybookExecution executePlaybook(
            @PathVariable Long playbookId,
            @RequestParam(required = false) Long incidentId) {

        return executionService.executePlaybook(playbookId, incidentId);
    }

    @GetMapping("/{playbookId}/executions")
    public List<PlaybookExecution> getExecutionHistory(
            @PathVariable Long playbookId) {

        return executionService.getExecutionHistory(playbookId);
    }

@GetMapping("/executions/{executionId}/actions")
public java.util.List<PlaybookActionExecution> getActionExecutionHistory(
        @PathVariable Long executionId) {

    return executionService.getActionExecutionHistory(executionId);
}

}
