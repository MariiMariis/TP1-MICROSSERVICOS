package br.com.medflow.appointment.dto;

import br.com.medflow.appointment.domain.Appointment;

import java.time.LocalDateTime;

public record AppointmentResponse(
        Long id,
        Long patientId,
        String patientName,
        String doctorName,
        String specialty,
        LocalDateTime scheduledAt,
        String status,
        String notes,
        LocalDateTime createdAt
) {
    public static AppointmentResponse from(Appointment appointment) {
        return new AppointmentResponse(
                appointment.getId(),
                appointment.getPatientId(),
                appointment.getPatientName(),
                appointment.getDoctorName(),
                appointment.getSpecialty(),
                appointment.getScheduledAt(),
                appointment.getStatus().name(),
                appointment.getNotes(),
                appointment.getCreatedAt()
        );
    }
}
