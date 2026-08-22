package br.com.medflow.appointment.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

@Entity
@Table(name = "appointments")
public class Appointment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "patient_name", length = 150)
    private String patientName;

    @Column(name = "patient_data_confirmed", nullable = false)
    private boolean patientDataConfirmed;

    @Column(name = "doctor_name", nullable = false, length = 150)
    private String doctorName;

    @Column(nullable = false, length = 80)
    private String specialty;

    @Column(name = "scheduled_at", nullable = false)
    private LocalDateTime scheduledAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AppointmentStatus status;

    @Column(length = 500)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    protected Appointment() {
    }

    public Appointment(Long patientId, String patientName, boolean patientDataConfirmed,
                       String doctorName, String specialty, LocalDateTime scheduledAt, String notes) {
        this.patientId = patientId;
        this.patientName = patientName;
        this.patientDataConfirmed = patientDataConfirmed;
        this.doctorName = doctorName;
        this.specialty = specialty;
        this.scheduledAt = scheduledAt;
        this.notes = notes;
        this.status = AppointmentStatus.AGENDADA;
        this.createdAt = LocalDateTime.now();
    }

    public void changeStatus(AppointmentStatus newStatus) {
        this.status = newStatus;
    }

    public void reschedule(LocalDateTime newDateTime) {
        this.scheduledAt = newDateTime;
        this.status = AppointmentStatus.AGENDADA;
    }

    public void confirmPatientData(String patientName) {
        this.patientName = patientName;
        this.patientDataConfirmed = true;
    }

    public Long getId() { return id; }
    public Long getPatientId() { return patientId; }
    public String getPatientName() { return patientName; }
    public boolean isPatientDataConfirmed() { return patientDataConfirmed; }
    public String getDoctorName() { return doctorName; }
    public String getSpecialty() { return specialty; }
    public LocalDateTime getScheduledAt() { return scheduledAt; }
    public AppointmentStatus getStatus() { return status; }
    public String getNotes() { return notes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
