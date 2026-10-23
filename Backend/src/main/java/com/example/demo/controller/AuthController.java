
package com.example.demo.controller;

import com.example.demo.entity.User;
import com.example.demo.service.AuthService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public String register(
            @RequestParam String name,
            @RequestParam String email,
            @RequestParam String password) {

        User user = authService.register(name, email, password);

        return "User registered successfully. User ID: " + user.getId();
    }


    @PostMapping("/login")
    public String login(
            @RequestParam String email,
            @RequestParam String password) {

        return authService.login(email, password);
    }
}

