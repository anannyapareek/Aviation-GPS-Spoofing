package com.aviation.siem.auth.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name = "forensic_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ForensicLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String icao24;
    private Float latitude;
    private Float longitude;
    private LocalDateTime timestamp;
    
    @Column(name = "mitre_technique")
    private String mitreTechnique;
    
    private String description;
    
    @Column(name = "forensic_hash", length = 64)
    private String forensicHash;

    @Column(name = "inserted_at", insertable = false, updatable = false)
    private LocalDateTime insertedAt;
}
