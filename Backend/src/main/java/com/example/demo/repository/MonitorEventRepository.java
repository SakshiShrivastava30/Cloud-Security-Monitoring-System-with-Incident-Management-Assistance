
package com.example.demo.repository;

import com.example.demo.entity.MonitorEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MonitorEventRepository
        extends JpaRepository<MonitorEvent, Long> {

    Optional<MonitorEvent> findBySourceEventId(Long sourceEventId);

}
