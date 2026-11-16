
package com.example.demo.repository;

import java.util.List;


import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.entity.PlaybookExecution;

public interface PlaybookExecutionRepository
        extends JpaRepository<PlaybookExecution, Long> {

    List<PlaybookExecution> findByPlaybookId(Long playbookId);
    List<PlaybookExecution> findByIncident_Id(Long incidentId);
    boolean existsByPlaybookId(Long playbookId);
    boolean existsByIncident_Id(Long incidentId);

}
