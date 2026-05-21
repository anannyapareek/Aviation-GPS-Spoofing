package com.aviation.siem.auth;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class HashGen {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        System.out.println("admin: " + encoder.encode("admin"));
        System.out.println("analyst: " + encoder.encode("analyst"));
        System.out.println("observer: " + encoder.encode("observer"));
    }
}
