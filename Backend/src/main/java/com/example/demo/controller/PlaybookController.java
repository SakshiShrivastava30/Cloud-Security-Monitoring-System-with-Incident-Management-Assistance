
package com.example.demo.controller;

import java.util.List;
import org.springframework.web.bind.annotation.*;

import com.example.demo.entity.Playbook;
import com.example.demo.service.PlaybookService;

@RestController
@RequestMapping("/api/playbooks")
public class PlaybookController {

    private final PlaybookService playbookService;

    public PlaybookController(PlaybookService playbookService) {
        this.playbookService = playbookService;
    }

    // Create playbook
    @PostMapping
    public Playbook createPlaybook(@RequestBody Playbook playbook) {

        System.out.println("Received name: " + playbook.getName());
        System.out.println("Received severity: " + playbook.getSeverity());

        return playbookService.createPlaybook(playbook);
    }

    // Get all playbooks
    @GetMapping
    public List<Playbook> getAllPlaybooks() {
        return playbookService.getAllPlaybooks();
    }

    // Get playbook by ID
    @GetMapping("/{id}")
    public Playbook getPlaybookById(@PathVariable Long id) {
        return playbookService.getPlaybookById(id);
    }

    // Update playbook
    @PutMapping("/{id}")
    public Playbook updatePlaybook(
            @PathVariable Long id,
            @RequestBody Playbook playbook) {
        return playbookService.updatePlaybook(id, playbook);
    }

    // Delete playbook
    @DeleteMapping("/{id}")
    public String deletePlaybook(@PathVariable Long id) {
        playbookService.deletePlaybook(id);
        return "Playbook deleted successfully";
    }
}
