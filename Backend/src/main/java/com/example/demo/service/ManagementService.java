
package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.entity.Team;
import com.example.demo.repository.UserRepository;
import com.example.demo.repository.TeamRepository;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional
public class ManagementService {

    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final PasswordEncoder passwordEncoder;

    public ManagementService(
            UserRepository userRepository,
            TeamRepository teamRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // USER MANAGEMENT

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public User getUser(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    public User createUser(User user) {
        if (userRepository.existsByEmail(user.getEmail())) {
            throw new IllegalArgumentException("Email already exists");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setActive(true);

        return userRepository.save(user);
    }

    public User updateUser(Long id, User updatedUser) {
        User user = getUser(id);

        if (updatedUser.getName() != null) {
            user.setName(updatedUser.getName());
        }

        if (updatedUser.getEmail() != null &&
                !updatedUser.getEmail().equalsIgnoreCase(user.getEmail())) {

            if (userRepository.existsByEmail(updatedUser.getEmail())) {
                throw new IllegalArgumentException("Email already exists");
            }

            user.setEmail(updatedUser.getEmail());
        }

        if (updatedUser.getRole() != null) {
            validateRole(updatedUser.getRole());
            user.setRole(updatedUser.getRole().toUpperCase());
        }

        return userRepository.save(user);
    }

    public User updateUserStatus(Long id, Boolean active) {
        User user = getUser(id);
        user.setActive(active);
        return userRepository.save(user);
    }

    public void deleteUser(Long id) {
        User user = getUser(id);

        for (Team team : user.getTeams()) {
            team.getUsers().remove(user);
        }

        user.getTeams().clear();
        userRepository.delete(user);
    }

    // TEAM MANAGEMENT

    public List<Team> getAllTeams() {
        return teamRepository.findAll();
    }

    public Team getTeam(Long id) {
        return teamRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Team not found"));
    }

    public Team createTeam(Team team) {
        if (teamRepository.existsByNameIgnoreCase(team.getName())) {
            throw new IllegalArgumentException("Team name already exists");
        }

        return teamRepository.save(team);
    }

    public Team updateTeam(Long id, Team updatedTeam) {
        Team team = getTeam(id);

        if (updatedTeam.getName() != null) {
            team.setName(updatedTeam.getName());
        }

        team.setDescription(updatedTeam.getDescription());

        return teamRepository.save(team);
    }

    public void deleteTeam(Long id) {
        Team team = getTeam(id);

        for (User user : team.getUsers()) {
            user.getTeams().remove(team);
        }

        team.getUsers().clear();
        teamRepository.delete(team);
    }

    // TEAM MEMBERS

    public void addMember(Long teamId, Long userId) {
        Team team = getTeam(teamId);
        User user = getUser(userId);

        user.getTeams().add(team);
        userRepository.save(user);
    }

    public void removeMember(Long teamId, Long userId) {
        Team team = getTeam(teamId);
        User user = getUser(userId);

        user.getTeams().remove(team);
        userRepository.save(user);
    }

    public List<User> getTeamMembers(Long teamId) {
        return List.copyOf(getTeam(teamId).getUsers());
    }

    private void validateRole(String role) {
        if (!List.of("ADMIN", "ANALYST", "VIEWER")
                .contains(role.trim().toUpperCase())) {
            throw new IllegalArgumentException("Invalid user role");
        }
    }
}
