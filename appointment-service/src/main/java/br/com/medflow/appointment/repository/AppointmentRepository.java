package br.com.medflow.appointment.repository;

import br.com.medflow.appointment.domain.Appointment;
import br.com.medflow.appointment.domain.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, Long> {
    List<Appointment> findByPatientIdOrderByScheduledAtDesc(Long patientId);

    List<Appointment> findByStatus(AppointmentStatus status);

    List<Appointment> findBySpecialtyIgnoreCase(String specialty);

    List<Appointment> findByPatientDataConfirmedFalse();
}
