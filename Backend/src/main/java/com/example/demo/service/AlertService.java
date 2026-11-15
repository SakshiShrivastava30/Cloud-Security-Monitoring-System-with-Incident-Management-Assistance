package com.example.demo.service;

import com.example.demo.entity.Alert;
import com.example.demo.entity.AlertStatus;
import com.example.demo.entity.MonitorEvent;
import com.example.demo.repository.AlertRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

@Service
public class AlertService {

    private final AlertRepository alertRepository;
    private final AlertRuleEngine alertRuleEngine;

    public AlertService(
            AlertRepository alertRepository,
            AlertRuleEngine alertRuleEngine) {

        this.alertRepository = alertRepository;
        this.alertRuleEngine = alertRuleEngine;
    }

    // Generate alert from monitoring event

    @Transactional
    public boolean evaluateAndCreate(MonitorEvent event) {

        if (event == null || event.getId() == null) {
            return false;
        }

        Optional<AlertRuleEngine.AlertRuleMatch> match =
                alertRuleEngine.evaluate(event);

        if (match.isEmpty()) {
            return false;
        }

        AlertRuleEngine.AlertRuleMatch rule = match.get();

        String deduplicationKey =
                rule.ruleCode() + ":" + event.getId();

        if (alertRepository.existsByDeduplicationKey(
                deduplicationKey)) {
            return false;
        }

        Alert alert = new Alert();

        alert.setMonitorEventId(event.getId());
        alert.setRuleCode(rule.ruleCode());
        alert.setDeduplicationKey(deduplicationKey);
        alert.setTitle(rule.title());
        alert.setDescription(rule.description());
        alert.setSeverity(rule.severity());
        alert.setStatus(AlertStatus.NEW);

        alert.setCategory(event.getEventCategory());
        alert.setSource(event.getSource());
        alert.setEventType(event.getEventType());
        alert.setSourceIp(event.getSourceIp());
        alert.setDomain(event.getDomain());
        alert.setEventTimestamp(event.getTimestamp());

        alertRepository.save(alert);

        return true;
    }

    // Get alerts with optional status filter

    @Transactional(readOnly = true)
    public Page<Alert> getAlerts(
            AlertStatus status,
            Pageable pageable) {

        if (status == null) {
            return alertRepository
                    .findAllByOrderByCreatedAtDesc(pageable);
        }

        return alertRepository
                .findByStatusOrderByCreatedAtDesc(
                        status,
                        pageable
                );
    }

    // Get alert by ID

    @Transactional(readOnly = true)
    public Optional<Alert> getAlert(Long id) {
        return alertRepository.findById(id);
    }

    // Acknowledge alert

    @Transactional
    public Optional<Alert> acknowledgeAlert(Long id) {

        return alertRepository.findById(id).map(alert -> {

            if (alert.getStatus() == AlertStatus.NEW) {

                alert.setStatus(AlertStatus.ACKNOWLEDGED);
                alert.setAcknowledgedAt(OffsetDateTime.now());

                return alertRepository.save(alert);
            }

            return alert;
        });
    }

    // Resolve alert

    @Transactional
    public Optional<Alert> resolveAlert(Long id) {

        return alertRepository.findById(id).map(alert -> {

            if (alert.getStatus() != AlertStatus.RESOLVED) {

                alert.setStatus(AlertStatus.RESOLVED);
                alert.setResolvedAt(OffsetDateTime.now());

                return alertRepository.save(alert);
            }

            return alert;
        });
    }
}