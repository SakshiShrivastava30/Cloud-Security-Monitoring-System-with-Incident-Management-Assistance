package com.example.demo.entity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
@Entity
@Table( name = "users")
@Getter
@Setter


public class User {
    @Id 
    @GeneratedValue(strategy = GenerationType.IDENTITY) 
    private Long Id;

    @Column (nullable = false)
    private String name;

    @Column(nullable =  false , unique = true) 
    private String email;

    @Column (nullable = false)
    private String password;

    @Column (nullable = false)
    private String role = "VIEWER";

    private LocalDateTime createdAt = LocalDateTime.now();
}

   