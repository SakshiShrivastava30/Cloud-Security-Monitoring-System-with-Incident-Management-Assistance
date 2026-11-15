
package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.regex.Pattern;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    private void validatePassword(String password) {

        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException(
                    "Password must contain at least 8 characters");
        }

        if (!Pattern.compile("[A-Z]").matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain an uppercase letter");
        }

        if (!Pattern.compile("[a-z]").matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain a lowercase letter");
        }

        if (!Pattern.compile("[0-9]").matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain a number");
        }

        if (!Pattern.compile("[^A-Za-z0-9\\s]").matcher(password).find()) {
            throw new IllegalArgumentException(
                    "Password must contain a special character");
        }
    }

    private String normalizeEmail(String email) {

        if (email == null || email.isBlank()) {
            throw new IllegalArgumentException("Email is required");
        }

        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public User register(String name, String email, String password) {

        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Name is required");
        }

        validatePassword(password);

        String normalizedEmail = normalizeEmail(email);

        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException(
                    "Email already registered");
        }

        User user = new User();

        user.setName(name.trim());
        user.setEmail(normalizedEmail);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole("VIEWER");

        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public String login(String email, String password) {

        String normalizedEmail = normalizeEmail(email);

        if (password == null || password.isBlank()) {
            throw new IllegalArgumentException("Password is required");
        }

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Invalid email or password"));

        if (user.getPassword() == null ||
                !passwordEncoder.matches(password, user.getPassword())) {

            throw new IllegalArgumentException(
                    "Invalid email or password");
        }

        String role = user.getRole();

        if (role == null || role.isBlank()) {
            throw new IllegalArgumentException(
                    "User role is not configured");
        }

        return jwtService.generateToken(
                user.getEmail(),
                role.trim().toUpperCase(Locale.ROOT)
        );
    }
}
