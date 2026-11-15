package com.example.demo.service;

import com.example.demo.entity.AlertSeverity;
import com.example.demo.entity.MonitorEvent;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Optional;

@Component
public class AlertRuleEngine {

    public Optional<AlertRuleMatch> evaluate(MonitorEvent event) {

        if (event == null) {
            return Optional.empty();
        }

        String category = normalize(event.getEventCategory());
        String eventType = normalize(event.getEventType());
        String severity = normalize(event.getSeverity());

        // RULE 1: Honeypot activity
        if ("HONEYPOT".equals(category)) {

            boolean sensitiveAccess =
                    eventType.contains("API_KEY")
                    || eventType.contains("SECRET")
                    || eventType.contains("TOKEN")
                    || eventType.contains("CREDENTIAL");

            if (sensitiveAccess) {
                return Optional.of(new AlertRuleMatch(
                        "HONEYPOT_SENSITIVE_ACCESS",
                        "Critical Honeypot Activity",
                        "An interaction with a sensitive decoy resource was detected.",
                        AlertSeverity.CRITICAL
                ));
            }

            return Optional.of(new AlertRuleMatch(
                    "HONEYPOT_INTERACTION",
                    "Honeypot Interaction Detected",
                    "A request interacted with the decoy honeypot service.",
                    AlertSeverity.HIGH
            ));
        }

        // RULE 2: Critical security event
        if ("CRITICAL".equals(severity)) {
            return Optional.of(new AlertRuleMatch(
                    "CRITICAL_EVENT",
                    "Critical Security Event",
                    "A critical monitoring event requires immediate investigation.",
                    AlertSeverity.CRITICAL
            ));
        }

        // RULE 3: High severity event
        if ("HIGH".equals(severity)) {
            return Optional.of(new AlertRuleMatch(
                    "HIGH_SEVERITY_EVENT",
                    "High Severity Security Event",
                    "A high severity monitoring event requires investigation.",
                    AlertSeverity.HIGH
            ));
        }

        return Optional.empty();
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.trim().toUpperCase(Locale.ROOT);
    }

    public record AlertRuleMatch(
            String ruleCode,
            String title,
            String description,
            AlertSeverity severity
    ) {
    }
}