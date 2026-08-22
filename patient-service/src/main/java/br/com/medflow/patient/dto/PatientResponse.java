package br.com.medflow.patient.dto;

import br.com.medflow.patient.domain.Patient;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record PatientResponse(
        Long id,
        String cpf,
        String fullName,
        LocalDate birthDate,
        String email,
        String phone,
        String healthPlan,
        boolean active,
        LocalDateTime createdAt
) {
    public static PatientResponse from(Patient patient) {
        return new PatientResponse(
                patient.getId(),
                patient.getCpf(),
                patient.getFullName(),
                patient.getBirthDate(),
                patient.getEmail(),
                patient.getPhone(),
                patient.getHealthPlan(),
                patient.isActive(),
                patient.getCreatedAt()
        );
    }
}
