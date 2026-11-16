
package com.example.demo.entity;

import java.time.LocalDateTime;

import jakarta.persistence.*;

@Entity
@Table(name = "playbook_action_executions")
public class PlaybookActionExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "execution_id", nullable = false)
    private PlaybookExecution execution;

    @ManyToOne
    @JoinColumn(name = "action_id", nullable = false)
    private PlaybookAction action;

    private String executionStatus;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    @Column(length = 2000)
    private String executionResult;

    public PlaybookActionExecution() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PlaybookExecution getExecution() {
        return execution;
    }

    public void setExecution(PlaybookExecution execution) {
        this.execution = execution;
    }

    public PlaybookAction getAction() {
        return action;
    }

    public void setAction(PlaybookAction action) {
        this.action = action;
    }

    public String getExecutionStatus() {
        return executionStatus;
    }

    public void setExecutionStatus(String executionStatus) {
        this.executionStatus = executionStatus;
    }

    public LocalDateTime getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(LocalDateTime startedAt) {
        this.startedAt = startedAt;
    }

    public LocalDateTime getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(LocalDateTime completedAt) {
        this.completedAt = completedAt;
    }

    public String getExecutionResult() {
        return executionResult;
    }

    public void setExecutionResult(String executionResult) {
        this.executionResult = executionResult;
    }
}
