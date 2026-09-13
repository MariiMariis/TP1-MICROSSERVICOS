package br.com.medflow.appointment.domain;

import java.time.LocalDateTime;

public class Appointment {
    private Long id;
    private final Long patientId;
    private final String patientName;
    private final String doctorName;
    private final String specialty;
    private final LocalDateTime scheduledAt;
    private final AppointmentStatus status;
    private final String notes;
    private final LocalDateTime createdAt;

    public Appointment(Long patientId, String patientName, String doctorName,
                       String specialty, LocalDateTime scheduledAt, String notes) {
        this.patientId = patientId;
        this.patientName = patientName;
        this.doctorName = doctorName;
        this.specialty = specialty;
        this.scheduledAt = scheduledAt;
        this.notes = notes;
        this.status = AppointmentStatus.AGENDADA;
        this.createdAt = LocalDateTime.now();
    }

    public void assignId(Long id) {
        this.id = id;
    }

    public Long getId() { return id; }
    public Long getPatientId() { return patientId; }
    public String getPatientName() { return patientName; }
    public String getDoctorName() { return doctorName; }
    public String getSpecialty() { return specialty; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public AppointmentStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
