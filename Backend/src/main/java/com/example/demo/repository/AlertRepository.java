package com.example.demo.repository;

import com.example.demo.entity.Alert;
import com.example.demo.entity.AlertStatus;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    boolean existsByDeduplicationKey(String deduplicationKey);

    Page<Alert> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Alert> findByStatusOrderByCreatedAtDesc(
            AlertStatus status,
            Pageable pageable
    );
}