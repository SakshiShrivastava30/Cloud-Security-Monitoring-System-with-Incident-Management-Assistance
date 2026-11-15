
package com.example.demo.controller;

import com.example.demo.entity.Team;
import com.example.demo.entity.User;
import com.example.demo.repository.TeamRepository;
import com.example.demo.repository.UserRepository;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/management")
@CrossOrigin(origins = "http://localhost:5173")
@Transactional
public class ManagementController {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final PasswordEncoder passwordEncoder;

    public ManagementController(
            UserRepository userRepository,
            TeamRepository teamRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // ================= DTOs =================

    public record UserRequest(
            String name,
            String email,
            String password,
            String role
    ) {}

    public record UserUpdateRequest(
            String name,
            String email,
            String role
    ) {}

    public record StatusRequest(Boolean active) {}

    public record UserResponse(
            Long id,
            String name,
            String email,
            String role,
            Boolean active,
            List<Long> teamIds,
            List<String> teamNames
    ) {}

    public record TeamRequest(
            String name,
            String description
    ) {}

    public record TeamResponse(
            Long id,
            String name,
            String description,
            int members,
            List<Long> memberIds,
            List<String> memberNames
    ) {}

    // ================= HELPERS =================

    private User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "User not found"));
    }

    private Team getTeam(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Team not found"));
    }

    private String validateRole(String role) {
        String cleanRole = role == null
                ? "VIEWER"
                : role.trim().toUpperCase();

        if (!Set.of("ADMIN", "ANALYST", "VIEWER").contains(cleanRole)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid role. Use ADMIN, ANALYST or VIEWER.");
        }

        return cleanRole;
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getActive(),
                user.getTeams().stream().map(Team::getId).toList(),
                user.getTeams().stream().map(Team::getName).toList()
        );
    }

    private TeamResponse toTeamResponse(Team team) {
        return new TeamResponse(
                team.getId(),
                team.getName(),
                team.getDescription(),
                team.getUsers().size(),
                team.getUsers().stream().map(User::getId).toList(),
                team.getUsers().stream().map(User::getName).toList()
        );
    }

    // ================= USER MANAGEMENT =================

    // GET ALL USERS
    @GetMapping("/users")
    public List<UserResponse> getAllUsers() {
        return userRepository.findAll()
                .stream()
                .map(this::toUserResponse)
                .toList();
    }

    // GET USER BY ID
    @GetMapping("/users/{id}")
    public UserResponse getUserById(@PathVariable Long id) {
        return toUserResponse(getUser(id));
    }

    // CREATE USER
    @PostMapping("/users")
    public ResponseEntity<UserResponse> createUser(
            @RequestBody UserRequest request) {

        if (request.name() == null || request.name().isBlank()
                || request.email() == null || request.email().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Name, email and password are required.");
        }

        String email = request.email().trim().toLowerCase();

        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Email already exists.");
        }

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setRole(validateRole(request.role()));
        user.setActive(true);

        User savedUser = userRepository.save(user);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toUserResponse(savedUser));
    }

    // UPDATE USER
    @PutMapping("/users/{id}")
    public UserResponse updateUser(
            @PathVariable Long id,
            @RequestBody UserUpdateRequest request) {

        User user = getUser(id);

        if (request.name() == null || request.name().isBlank()
                || request.email() == null || request.email().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Name and email are required.");
        }

        String email = request.email().trim().toLowerCase();

        userRepository.findByEmail(email)
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT, "Email already exists.");
                });

        user.setName(request.name().trim());
        user.setEmail(email);
        user.setRole(validateRole(request.role()));

        return toUserResponse(userRepository.save(user));
    }

    // ACTIVATE / DEACTIVATE USER
    @PatchMapping("/users/{id}/status")
    public UserResponse updateUserStatus(
            @PathVariable Long id,
            @RequestBody StatusRequest request) {

        if (request.active() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Active status is required.");
        }

        User user = getUser(id);
        user.setActive(request.active());

        return toUserResponse(userRepository.save(user));
    }

    // DELETE USER
    @DeleteMapping("/users/{id}")
    public ResponseEntity<Void> deleteUser(@PathVariable Long id) {

        User user = getUser(id);

        for (Team team : user.getTeams()) {
            team.getUsers().remove(user);
        }

        user.getTeams().clear();
        userRepository.delete(user);

        return ResponseEntity.noContent().build();
    }

    // ================= TEAM MANAGEMENT =================

    // GET ALL TEAMS
    @GetMapping("/teams")
    public List<TeamResponse> getAllTeams() {
        return teamRepository.findAll()
                .stream()
                .map(this::toTeamResponse)
                .toList();
    }

    // GET TEAM BY ID
    @GetMapping("/teams/{id}")
    public TeamResponse getTeamById(@PathVariable Long id) {
        return toTeamResponse(getTeam(id));
    }

    // CREATE TEAM
    @PostMapping("/teams")
    public ResponseEntity<TeamResponse> createTeam(
            @RequestBody TeamRequest request) {

        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Team name is required.");
        }

        String name = request.name().trim();

        if (teamRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Team already exists.");
        }

        Team team = new Team();
        team.setName(name);
        team.setDescription(request.description());

        Team savedTeam = teamRepository.save(team);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(toTeamResponse(savedTeam));
    }

    // UPDATE TEAM
    @PutMapping("/teams/{id}")
    public TeamResponse updateTeam(
            @PathVariable Long id,
            @RequestBody TeamRequest request) {

        Team team = getTeam(id);

        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Team name is required.");
        }

        String name = request.name().trim();

        if (!team.getName().equalsIgnoreCase(name)
                && teamRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "Team name already exists.");
        }

        team.setName(name);
        team.setDescription(request.description());

        return toTeamResponse(teamRepository.save(team));
    }

    // DELETE TEAM
    @DeleteMapping("/teams/{id}")
    public ResponseEntity<Void> deleteTeam(@PathVariable Long id) {

        Team team = getTeam(id);

        for (User user : team.getUsers()) {
            user.getTeams().remove(team);
        }

        team.getUsers().clear();
        teamRepository.delete(team);

        return ResponseEntity.noContent().build();
    }

    // ================= TEAM MEMBERS =================

    // ADD USER TO TEAM
    @PostMapping("/teams/{teamId}/members/{userId}")
    public TeamResponse addMember(
            @PathVariable Long teamId,
            @PathVariable Long userId) {

        Team team = getTeam(teamId);
        User user = getUser(userId);

        user.getTeams().add(team);
        userRepository.save(user);

        return toTeamResponse(team);
    }

    // REMOVE USER FROM TEAM
    @DeleteMapping("/teams/{teamId}/members/{userId}")
    public TeamResponse removeMember(
            @PathVariable Long teamId,
            @PathVariable Long userId) {

        Team team = getTeam(teamId);
        User user = getUser(userId);

        user.getTeams().remove(team);
        userRepository.save(user);

        return toTeamResponse(team);
    }

    // GET TEAM MEMBERS
    @GetMapping("/teams/{teamId}/members")
    public List<UserResponse> getTeamMembers(
            @PathVariable Long teamId) {

        Team team = getTeam(teamId);

        return team.getUsers()
                .stream()
                .map(this::toUserResponse)
                .toList();
    }
}
