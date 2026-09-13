package br.com.medflow.patient.domain;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class Patient {
    private Long id;
    private final String cpf;
    private final String fullName;
    private final LocalDate birthDate;
    private final String email;
    private final String phone;
    private final String healthPlan;
    private final boolean active;
    private final LocalDateTime createdAt;

    public Patient(String cpf, String fullName, LocalDate birthDate,
                   String email, String phone, String healthPlan) {
        this.cpf = cpf;
        this.fullName = fullName;
        this.birthDate = birthDate;
        this.email = email;
        this.phone = phone;
        this.healthPlan = healthPlan;
        this.active = true;
        this.createdAt = LocalDateTime.now();
    }

    public void assignId(Long id) {
        this.id = id;
    }

    public Long getId() { return id; }
    public String getCpf() { return cpf; }
    public String getFullName() { return fullName; }
    public LocalDate getBirthDate() { return birthDate; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getHealthPlan() { return healthPlan; }
    public boolean isActive() { return active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
