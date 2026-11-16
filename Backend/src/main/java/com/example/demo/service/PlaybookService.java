
package com.example.demo.service;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.entity.Playbook;
import com.example.demo.repository.PlaybookRepository;
import com.example.demo.repository.PlaybookActionRepository;
import com.example.demo.repository.PlaybookExecutionRepository;

@Service
public class PlaybookService {

    private final PlaybookRepository playbookRepository;
    private final PlaybookActionRepository playbookActionRepository;
    private final PlaybookExecutionRepository playbookExecutionRepository;

    private static final Set<String> VALID_SEVERITIES =
            Set.of("LOW", "MEDIUM", "HIGH", "CRITICAL");

    private static final Set<String> VALID_STATUSES =
            Set.of("DRAFT", "ACTIVE", "INACTIVE");

    public PlaybookService(
            PlaybookRepository playbookRepository,
            PlaybookActionRepository playbookActionRepository,
            PlaybookExecutionRepository playbookExecutionRepository) {

        this.playbookRepository = playbookRepository;
        this.playbookActionRepository = playbookActionRepository;
        this.playbookExecutionRepository = playbookExecutionRepository;
    }

    // Validate playbook fields
    private void validatePlaybook(Playbook playbook) {

        if (playbook.getName() == null ||
                playbook.getName().trim().isEmpty()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Playbook name is required");
        }

        if (playbook.getSeverity() == null ||
                !VALID_SEVERITIES.contains(
                        playbook.getSeverity().trim().toUpperCase())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid severity. Allowed: LOW, MEDIUM, HIGH, CRITICAL");
        }

        if (playbook.getStatus() == null ||
                !VALID_STATUSES.contains(
                        playbook.getStatus().trim().toUpperCase())) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid status. Allowed: DRAFT, ACTIVE, INACTIVE");
        }
    }

    // Prevent multiple active playbooks for the same severity
    private void checkDuplicateActivePlaybook(
            String severity, Long currentPlaybookId) {

        List<Playbook> matchingPlaybooks =
                playbookRepository.findBySeverityIgnoreCaseAndStatusIgnoreCase(
                        severity, "ACTIVE");

        for (Playbook existing : matchingPlaybooks) {

            if (currentPlaybookId == null ||
                    !existing.getId().equals(currentPlaybookId)) {

                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "An active playbook already exists for severity: "
                                + severity);
            }
        }
    }

    // Create a new playbook
    public Playbook createPlaybook(Playbook playbook) {

        if (playbook.getStatus() == null ||
                playbook.getStatus().trim().isEmpty()) {
            playbook.setStatus("DRAFT");
        }

        if (playbook.getName() != null) {
            playbook.setName(playbook.getName().trim());
        }

        if (playbook.getSeverity() != null) {
            playbook.setSeverity(
                    playbook.getSeverity().trim().toUpperCase());
        }

        playbook.setStatus(playbook.getStatus().trim().toUpperCase());

        validatePlaybook(playbook);

        if ("ACTIVE".equals(playbook.getStatus())) {
            checkDuplicateActivePlaybook(
                    playbook.getSeverity(), null);
        }

        return playbookRepository.save(playbook);
    }

    // Get all playbooks
    public List<Playbook> getAllPlaybooks() {
        return playbookRepository.findAll();
    }

    // Get playbook by ID
    public Playbook getPlaybookById(Long id) {
        return playbookRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Playbook not found with ID: " + id));
    }

    // Update playbook
    public Playbook updatePlaybook(Long id, Playbook updatedPlaybook) {

        Playbook existing = getPlaybookById(id);

        if (updatedPlaybook.getName() != null) {
            existing.setName(updatedPlaybook.getName().trim());
        }

        existing.setDescription(updatedPlaybook.getDescription());

        if (updatedPlaybook.getSeverity() != null) {
            existing.setSeverity(
                    updatedPlaybook.getSeverity().trim().toUpperCase());
        }

        if (updatedPlaybook.getStatus() != null &&
                !updatedPlaybook.getStatus().trim().isEmpty()) {
            existing.setStatus(
                    updatedPlaybook.getStatus().trim().toUpperCase());
        }

        validatePlaybook(existing);

        if ("ACTIVE".equals(existing.getStatus())) {
            checkDuplicateActivePlaybook(
                    existing.getSeverity(), id);
        }

        return playbookRepository.save(existing);
    }

    // Delete playbook safely
    public void deletePlaybook(Long id) {

        Playbook existing = getPlaybookById(id);

        boolean hasActions =
                playbookActionRepository.existsByPlaybookId(id);

        boolean hasExecutions =
                playbookExecutionRepository.existsByPlaybookId(id);

        if (hasActions || hasExecutions) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cannot delete playbook because it has actions or execution history. Set its status to INACTIVE instead.");
        }

        playbookRepository.delete(existing);
    }
}
