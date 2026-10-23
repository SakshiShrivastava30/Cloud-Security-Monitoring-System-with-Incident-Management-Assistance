package com.example.demo.service;
import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

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

    public User register(String name, String email, String password){

        if (userRepository.existsByEmail(email)){
            throw new RuntimeException("Email already registered");
    }
        
    User user = new User();

    user.setName(name);
    user.setEmail(email);
    user. setPassword(passwordEncoder.encode(password));
    user.setRole ("VIEWER");
    return userRepository.save(user);
    
}

 public String login(String email, String password) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new RuntimeException("Invalid email or password"));

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new RuntimeException("Invalid email or password");
        }

        return jwtService.generateToken(
                user.getEmail(),
                user.getRole()
        );
    }
}

