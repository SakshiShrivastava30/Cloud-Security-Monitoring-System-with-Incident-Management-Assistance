
package com.example.demo.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "playbook_actions")
public class PlaybookAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "playbook_id", nullable = false)
    private Playbook playbook;

    @Column(nullable = false)
    private String actionType;

    @Column(length = 2000)
    private String actionConfig;

    private Integer executionOrder;

    // Default constructor
    public PlaybookAction() {
    }

    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Playbook getPlaybook() {
        return playbook;
    }

    public void setPlaybook(Playbook playbook) {
        this.playbook = playbook;
    }

    public String getActionType() {
        return actionType;
    }

    public void setActionType(String actionType) {
        this.actionType = actionType;
    }

    public String getActionConfig() {
        return actionConfig;
    }

    public void setActionConfig(String actionConfig) {
        this.actionConfig = actionConfig;
    }

    public Integer getExecutionOrder() {
        return executionOrder;
    }

    public void setExecutionOrder(Integer executionOrder) {
        this.executionOrder = executionOrder;
    }
}
