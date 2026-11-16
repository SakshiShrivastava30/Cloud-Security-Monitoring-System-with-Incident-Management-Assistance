
package com.example.demo.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.demo.entity.Incident;

public interface IncidentRepository
        extends JpaRepository<Incident, Long> {

}
