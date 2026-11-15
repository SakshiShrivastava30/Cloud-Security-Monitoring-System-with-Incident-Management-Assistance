
package com.example.demo.repository;

import com.example.demo.entity.Incident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface IncidentRepository extends JpaRepository<Incident, Long> {

    // Get incidents by status
    Page<Incident> findByStatusOrderByCreatedAtDesc(
            String status,
            Pageable pageable
    );

    // Get all incidents in latest-first order
    Page<Incident> findAllByOrderByCreatedAtDesc(
            Pageable pageable
    );

    // Get incidents assigned to a particular analyst
    List<Incident> findByAssignedToUserId(Long userId);

    // Find incident linked to an alert
    Optional<Incident> findByAlertId(Long alertId);

    // Check whether an alert already has an incident
    boolean existsByAlertId(Long alertId);
}

