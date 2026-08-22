package br.com.medflow.appointment.service;

import br.com.medflow.appointment.client.PatientGateway;
import br.com.medflow.appointment.client.PatientSnapshot;
import br.com.medflow.appointment.domain.Appointment;
import br.com.medflow.appointment.domain.AppointmentStatus;
import br.com.medflow.appointment.dto.AppointmentRequest;
import br.com.medflow.appointment.dto.AppointmentResponse;
import br.com.medflow.appointment.exception.ResourceNotFoundException;
import br.com.medflow.appointment.repository.AppointmentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AppointmentService {
    private static final Logger log = LoggerFactory.getLogger(AppointmentService.class);

    private final AppointmentRepository repository;
    private final PatientGateway patientGateway;

    public AppointmentService(AppointmentRepository repository, PatientGateway patientGateway) {
        this.repository = repository;
        this.patientGateway = patientGateway;
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> findAll() {
        return repository.findAll().stream().map(AppointmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public AppointmentResponse findById(Long id) {
        return AppointmentResponse.from(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> findByPatient(Long patientId) {
        return repository.findByPatientIdOrderByScheduledAtDesc(patientId)
                .stream().map(AppointmentResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> findBySpecialty(String specialty) {
        return repository.findBySpecialtyIgnoreCase(specialty)
                .stream().map(AppointmentResponse::from).toList();
    }

    @Transactional
    public AppointmentResponse schedule(AppointmentRequest request) {
        PatientSnapshot patient = patientGateway.findPatient(request.patientId());

        if (patient.dataFromFallback()) {
            log.warn("Consulta do paciente {} sera gravada em MODO DEGRADADO.", request.patientId());
        }

        Appointment appointment = new Appointment(
                request.patientId(),
                patient.fullName(),
                !patient.dataFromFallback(),
                request.doctorName(),
                request.specialty(),
                request.scheduledAt(),
                request.notes()
        );
        return AppointmentResponse.from(repository.save(appointment));
    }

    @Transactional
    public AppointmentResponse changeStatus(Long id, AppointmentStatus status) {
        Appointment appointment = getOrThrow(id);
        appointment.changeStatus(status);
        return AppointmentResponse.from(repository.save(appointment));
    }

    @Transactional
    public AppointmentResponse cancel(Long id) {
        return changeStatus(id, AppointmentStatus.CANCELADA);
    }

    @Transactional
    public List<AppointmentResponse> reconcilePendingPatientData() {
        List<Appointment> pending = repository.findByPatientDataConfirmedFalse();
        for (Appointment appointment : pending) {
            PatientSnapshot patient = patientGateway.findPatient(appointment.getPatientId());
            if (!patient.dataFromFallback()) {
                appointment.confirmPatientData(patient.fullName());
                repository.save(appointment);
                log.info("Dados do paciente {} confirmados na consulta {}.",
                        appointment.getPatientId(), appointment.getId());
            }
        }
        return pending.stream().map(AppointmentResponse::from).toList();
    }

    private Appointment getOrThrow(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Consulta nao encontrada. id=" + id));
    }
}
