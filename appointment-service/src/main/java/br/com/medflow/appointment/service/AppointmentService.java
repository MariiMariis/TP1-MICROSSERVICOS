package br.com.medflow.appointment.service;

import br.com.medflow.appointment.client.PatientClient;
import br.com.medflow.appointment.client.PatientSnapshot;
import br.com.medflow.appointment.domain.Appointment;
import br.com.medflow.appointment.dto.AppointmentRequest;
import br.com.medflow.appointment.dto.AppointmentResponse;
import br.com.medflow.appointment.exception.ResourceNotFoundException;
import br.com.medflow.appointment.repository.AppointmentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AppointmentService {
    private final AppointmentRepository repository;
    private final PatientClient patientClient;

    public AppointmentService(AppointmentRepository repository, PatientClient patientClient) {
        this.repository = repository;
        this.patientClient = patientClient;
    }

    public List<AppointmentResponse> findAll() {
        return repository.findAll().stream().map(AppointmentResponse::from).toList();
    }

    public AppointmentResponse findById(Long id) {
        Appointment appointment = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Consulta nao encontrada. id=" + id));
        return AppointmentResponse.from(appointment);
    }

    public AppointmentResponse schedule(AppointmentRequest request) {
        PatientSnapshot patient = patientClient.findById(request.patientId());
        Appointment appointment = new Appointment(
                patient.id(),
                patient.fullName(),
                request.doctorName(),
                request.specialty(),
                request.scheduledAt(),
                request.notes()
        );
        return AppointmentResponse.from(repository.save(appointment));
    }
}
