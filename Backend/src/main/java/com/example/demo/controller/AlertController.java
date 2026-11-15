package com.example.demo.controller;

import com.example.demo.entity.Alert;
import com.example.demo.entity.AlertStatus;
import com.example.demo.service.AlertService;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/alerts")
public class AlertController {

    private final AlertService alertService;

    public AlertController(AlertService alertService) {
        this.alertService = alertService;
    }

    // GET ALL ALERTS

    @GetMapping
    public ResponseEntity<?> getAlerts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status) {

        if (page < 0 || size < 1) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid page or size"));
        }

        size = Math.min(size, 100);

        AlertStatus alertStatus = null;

        if (status != null && !status.isBlank()) {
            try {
                alertStatus = AlertStatus.valueOf(
                        status.trim().toUpperCase(Locale.ROOT)
                );
            } catch (IllegalArgumentException exception) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid alert status"));
            }
        }

        Page<Alert> result = alertService.getAlerts(
                alertStatus,
                PageRequest.of(
                        page,
                        size,
                        Sort.by(
                                Sort.Direction.DESC,
                                "createdAt"
                        )
                )
        );

        return ResponseEntity.ok(
                Map.of(
                        "alerts", result.getContent(),
                        "page", result.getNumber(),
                        "size", result.getSize(),
                        "totalElements", result.getTotalElements(),
                        "totalPages", result.getTotalPages()
                )
        );
    }

    // GET ALERT BY ID

    @GetMapping("/{id}")
    public ResponseEntity<?> getAlert(@PathVariable Long id) {

        Optional<Alert> alert = alertService.getAlert(id);

        if (alert.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(alert.get());
    }

    // ACKNOWLEDGE ALERT

    @PatchMapping("/{id}/acknowledge")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> acknowledgeAlert(
            @PathVariable Long id) {

        Optional<Alert> alert = alertService.acknowledgeAlert(id);

        if (alert.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(
                Map.of(
                        "message", "Alert acknowledged successfully",
                        "alert", alert.get()
                )
        );
    }

    // RESOLVE ALERT

    @PatchMapping("/{id}/resolve")
    @PreAuthorize("hasAnyRole('ADMIN', 'ANALYST')")
    public ResponseEntity<?> resolveAlert(
            @PathVariable Long id) {

        Optional<Alert> alert = alertService.resolveAlert(id);

        if (alert.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(
                Map.of(
                        "message", "Alert resolved successfully",
                        "alert", alert.get()
                )
        );
    }
}