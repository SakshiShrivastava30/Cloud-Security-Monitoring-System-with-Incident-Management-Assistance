
package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Entity
@Table(name = "monitor_events")
@Getter
@Setter
public class MonitorEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "source_event_id", unique = true)
    private Long sourceEventId;

    @Column(name = "event_time", nullable = false)
    private OffsetDateTime timestamp;

    @Column(name = "event_category", nullable = false)
    private String eventCategory;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(nullable = false)
    private String source;

    private String username;

    private Integer processId;

    private Integer parentProcessId;

    @Column(columnDefinition = "TEXT")
    private String filePath;

    private String sourceIp;

    private String destinationIp;

    private String domain;

    private String severity;

    @Column(name = "details_json", columnDefinition = "TEXT")
    private String detailsJson;

    private String collectionStatus;

    private String collector;
}
