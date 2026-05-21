package com.aviation.siem.auth.payload.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ForensicLogResponse {
    private Long id;
    private String icao24;
    private Float latitude;
    private Float longitude;
    private LocalDateTime timestamp;
    private String mitreTechnique;
    private String description;
    private String forensicHash;
    private LocalDateTime insertedAt;
}
