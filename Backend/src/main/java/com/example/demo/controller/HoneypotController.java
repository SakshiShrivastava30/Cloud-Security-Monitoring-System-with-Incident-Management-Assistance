
package com.example.demo.controller;

import com.example.demo.entity.MonitorEvent;
import com.example.demo.repository.MonitorEventRepository;
import com.example.demo.service.AlertService;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/honeypot")
public class HoneypotController {

    private final MonitorEventRepository eventRepository;
    private final AlertService alertService;

    public HoneypotController(
            MonitorEventRepository eventRepository,
            AlertService alertService) {

        this.eventRepository = eventRepository;
        this.alertService = alertService;
    }

    // Normal honeypot interaction
    @RequestMapping(
            value = {"/admin", "/dashboard", "/login"},
            method = {RequestMethod.GET, RequestMethod.POST}
    )
    @Transactional
    public ResponseEntity<?> captureInteraction(
            HttpServletRequest request) {

        recordHoneypotEvent(
                request,
                "HONEYPOT_INTERACTION",
                "HIGH"
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "Resource not found"));
    }

    // Sensitive honeypot interaction
    @RequestMapping(
            value = {
                    "/api-key",
                    "/api-keys",
                    "/credentials",
                    "/secrets",
                    "/token"
            },
            method = {
                    RequestMethod.GET,
                    RequestMethod.POST,
                    RequestMethod.PUT,
                    RequestMethod.PATCH,
                    RequestMethod.DELETE
            }
    )
    @Transactional
    public ResponseEntity<?> captureSensitiveInteraction(
            HttpServletRequest request) {

        recordHoneypotEvent(
                request,
                "HONEYPOT_API_KEY_ACCESS",
                "CRITICAL"
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "Resource not found"));
    }

    private void recordHoneypotEvent(
            HttpServletRequest request,
            String eventType,
            String severity) {

        MonitorEvent event = new MonitorEvent();

        event.setTimestamp(OffsetDateTime.now());
        event.setEventCategory("HONEYPOT");
        event.setEventType(eventType);
        event.setSource("HONEYPOT_ENDPOINT");
        event.setSourceIp(request.getRemoteAddr());
        event.setSeverity(severity);
        event.setCollectionStatus("collected");
        event.setCollector("SPRING_BOOT_HONEYPOT");

        // Record request metadata only; never store request bodies.
        event.setDetailsJson(
                "{\"method\":\"" + escapeJson(request.getMethod())
                + "\",\"path\":\"" + escapeJson(request.getRequestURI())
                + "\",\"userAgent\":\""
                + escapeJson(request.getHeader("User-Agent")) + "\"}"
        );

        MonitorEvent savedEvent = eventRepository.save(event);

        // Trigger existing Alert Engine
        alertService.evaluateAndCreate(savedEvent);
    }

    private String escapeJson(String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", " ")
                .replace("\r", " ");
    }
}
