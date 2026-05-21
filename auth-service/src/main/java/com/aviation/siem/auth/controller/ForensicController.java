package com.aviation.siem.auth.controller;

import com.aviation.siem.auth.model.ForensicLog;
import com.aviation.siem.auth.payload.response.ForensicLogResponse;
import com.aviation.siem.auth.repository.ForensicLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/forensic")
public class ForensicController {

    @Autowired
    private ForensicLogRepository forensicLogRepository;

    @GetMapping("/data")
    @PreAuthorize("hasRole('ANALYST') or hasRole('ADMIN')")
    public List<ForensicLogResponse> getForensicData() {
        List<ForensicLog> logs = forensicLogRepository.findAll();
        
        return logs.stream().map(log -> new ForensicLogResponse(
            log.getId(),
            log.getIcao24(),
            log.getLatitude(),
            log.getLongitude(),
            log.getTimestamp(),
            log.getMitreTechnique(),
            log.getDescription(),
            log.getForensicHash(),
            log.getInsertedAt()
        )).collect(Collectors.toList());
    }

    @GetMapping("/public")
    public String getPublicData() {
        return "Public Flight Data: Basic flight info.";
    }
}
