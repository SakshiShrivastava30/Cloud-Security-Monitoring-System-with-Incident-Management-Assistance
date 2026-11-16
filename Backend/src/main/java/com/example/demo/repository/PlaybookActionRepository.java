
package com.example.demo.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.entity.PlaybookAction;

public interface PlaybookActionRepository
        extends JpaRepository<PlaybookAction, Long> {

    List<PlaybookAction> findByPlaybookId(Long playbookId);
    boolean existsByPlaybookIdAndExecutionOrder(
            Long playbookId, Integer executionOrder);
    boolean existsByPlaybookId(Long playbookId);
}
