package com.aviation.siem.auth.repository;

import com.aviation.siem.auth.model.ForensicLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ForensicLogRepository extends JpaRepository<ForensicLog, Long> {
}
