
package com.example.demo.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.demo.entity.Playbook;

public interface PlaybookRepository extends JpaRepository<Playbook, Long> {

    List<Playbook> findBySeverityIgnoreCaseAndStatusIgnoreCase(
            String severity, String status);
}
