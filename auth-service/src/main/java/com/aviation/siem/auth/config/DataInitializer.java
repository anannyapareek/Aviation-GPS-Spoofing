package com.aviation.siem.auth.config;

import com.aviation.siem.auth.model.ERole;
import com.aviation.siem.auth.model.Role;
import com.aviation.siem.auth.model.User;
import com.aviation.siem.auth.repository.RoleRepository;
import com.aviation.siem.auth.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    RoleRepository roleRepository;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder encoder;

    @Override
    public void run(String... args) throws Exception {
        // Seed Roles
        if (roleRepository.count() == 0) {
            roleRepository.save(new Role(null, ERole.ROLE_OBSERVER));
            roleRepository.save(new Role(null, ERole.ROLE_ANALYST));
            roleRepository.save(new Role(null, ERole.ROLE_ADMIN));
        }

        // Seed Admin User
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setPassword(encoder.encode("admin123"));
            Set<Role> roles = new HashSet<>();
            roles.add(roleRepository.findByName(ERole.ROLE_ADMIN).get());
            admin.setRoles(roles);
            userRepository.save(admin);
        }

        // Seed Analyst User
        if (!userRepository.existsByUsername("analyst")) {
            User analyst = new User();
            analyst.setUsername("analyst");
            analyst.setPassword(encoder.encode("analyst123"));
            Set<Role> roles = new HashSet<>();
            roles.add(roleRepository.findByName(ERole.ROLE_ANALYST).get());
            analyst.setRoles(roles);
            userRepository.save(analyst);
        }

        // Seed Observer User
        if (!userRepository.existsByUsername("observer")) {
            User observer = new User();
            observer.setUsername("observer");
            observer.setPassword(encoder.encode("observer123"));
            Set<Role> roles = new HashSet<>();
            roles.add(roleRepository.findByName(ERole.ROLE_OBSERVER).get());
            observer.setRoles(roles);
            userRepository.save(observer);
        }
    }
}
