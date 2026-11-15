
package com.example.demo.controller;

import com.example.demo.entity.MonitorEvent;
import com.example.demo.repository.MonitorEventRepository;
import com.example.demo.service.AlertService;

import com.fasterxml.jackson.annotation.JsonProperty;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/monitor/events")
public class MonitorEventController {

    private final MonitorEventRepository eventRepository;
    private final AlertService alertService;

    @Value("${monitor.agent.api-key:}")
    private String configuredApiKey;

    public MonitorEventController(
            MonitorEventRepository eventRepository,
            AlertService alertService) {

        this.eventRepository = eventRepository;
        this.alertService = alertService;
    }

    // ================= PYTHON AGENT: RECEIVE EVENTS =================

    @PostMapping("/batch")
    @Transactional
    public ResponseEntity<?> receiveEvents(
            @RequestHeader(value = "X-Agent-Key", required = false)
            String agentKey,
            @RequestBody List<MonitorEventRequest> requests) {

        if (!isValidAgentKey(agentKey)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "error",
                            "Invalid monitoring agent API key"
                    ));
        }

        if (requests == null || requests.isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Event list cannot be empty"));
        }

        if (requests.size() > 500) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "Maximum 500 events allowed per batch"
                    ));
        }

        List<MonitorEvent> eventsToSave = new ArrayList<>();

        Set<Long> seenIds = new HashSet<>();

        int duplicates = 0;

        try {

            for (MonitorEventRequest request : requests) {

                if (request.timestamp() == null ||
                    request.eventCategory() == null ||
                    request.eventType() == null ||
                    request.source() == null) {

                    return ResponseEntity.badRequest()
                            .body(Map.of(
                                    "error",
                                    "Required event fields are missing"
                            ));
                }

                Long sourceId = request.sourceEventId();

                if (sourceId != null) {

                    if (!seenIds.add(sourceId) ||
                        eventRepository.findBySourceEventId(sourceId).isPresent()) {

                        duplicates++;
                        continue;
                    }
                }

                MonitorEvent event = new MonitorEvent();

                event.setSourceEventId(sourceId);

                event.setTimestamp(
                        OffsetDateTime.parse(request.timestamp())
                );

                event.setEventCategory(request.eventCategory());
                event.setEventType(request.eventType());
                event.setSource(request.source());

                event.setUsername(request.username());
                event.setProcessId(request.processId());
                event.setParentProcessId(request.parentProcessId());
                event.setFilePath(request.filePath());

                event.setSourceIp(request.sourceIp());
                event.setDestinationIp(request.destinationIp());
                event.setDomain(request.domain());

                event.setSeverity(
                        request.severity() != null
                                ? request.severity()
                                : "unknown"
                );

                event.setDetailsJson(
                        request.detailsJson() != null
                                ? request.detailsJson()
                                : "{}"
                );

                event.setCollectionStatus(
                        request.collectionStatus() != null
                                ? request.collectionStatus()
                                : "collected"
                );

                event.setCollector(request.collector());

                eventsToSave.add(event);
            }

        } catch (DateTimeParseException exception) {

            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "error",
                            "Invalid event timestamp format"
                    ));
        }

        // STEP 1: Save new monitoring events
        List<MonitorEvent> savedEvents =
                eventRepository.saveAll(eventsToSave);

        // STEP 2: Evaluate saved events using Alert Engine
        int alertsCreated = 0;

        for (MonitorEvent savedEvent : savedEvents) {

            boolean alertGenerated =
                    alertService.evaluateAndCreate(savedEvent);

            if (alertGenerated) {
                alertsCreated++;
            }
        }

        // STEP 3: Return ingestion and alert statistics
        return ResponseEntity.ok(
                Map.of(
                        "message",
                        "Monitoring events processed successfully",

                        "received",
                        requests.size(),

                        "inserted",
                        savedEvents.size(),

                        "duplicates",
                        duplicates,

                        "alertsCreated",
                        alertsCreated
                )
        );
    }

    // ================= DASHBOARD: GET ALL EVENTS =================

    @GetMapping
    public ResponseEntity<?> getEvents(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        if (page < 0 || size < 1) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid page or size"));
        }

        size = Math.min(size, 200);

        Page<MonitorEvent> result = eventRepository.findAll(
                PageRequest.of(
                        page,
                        size,
                        Sort.by(Sort.Direction.DESC, "timestamp")
                )
        );

        return ResponseEntity.ok(
                Map.of(
                        "events", result.getContent(),
                        "page", result.getNumber(),
                        "size", result.getSize(),
                        "totalElements", result.getTotalElements(),
                        "totalPages", result.getTotalPages()
                )
        );
    }

    // ================= API KEY VALIDATION =================

    private boolean isValidAgentKey(String suppliedKey) {

        if (configuredApiKey == null ||
            configuredApiKey.isBlank() ||
            suppliedKey == null) {

            return false;
        }

        return MessageDigest.isEqual(
                configuredApiKey.getBytes(StandardCharsets.UTF_8),
                suppliedKey.getBytes(StandardCharsets.UTF_8)
        );
    }

    // ================= REQUEST DTO =================

    public record MonitorEventRequest(

            @JsonProperty("id")
            Long sourceEventId,

            @JsonProperty("timestamp")
            String timestamp,

            @JsonProperty("event_category")
            String eventCategory,

            @JsonProperty("event_type")
            String eventType,

            @JsonProperty("source")
            String source,

            @JsonProperty("username")
            String username,

            @JsonProperty("process_id")
            Integer processId,

            @JsonProperty("parent_process_id")
            Integer parentProcessId,

            @JsonProperty("file_path")
            String filePath,

            @JsonProperty("source_ip")
            String sourceIp,

            @JsonProperty("destination_ip")
            String destinationIp,

            @JsonProperty("domain")
            String domain,

            @JsonProperty("severity")
            String severity,

            @JsonProperty("details_json")
            String detailsJson,

            @JsonProperty("collection_status")
            String collectionStatus,

            @JsonProperty("collector")
            String collector
    ) {}
}
