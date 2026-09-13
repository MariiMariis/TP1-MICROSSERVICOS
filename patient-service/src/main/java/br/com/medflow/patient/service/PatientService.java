package br.com.medflow.patient.service;

import br.com.medflow.patient.domain.Patient;
import br.com.medflow.patient.dto.PatientRequest;
import br.com.medflow.patient.dto.PatientResponse;
import br.com.medflow.patient.exception.BusinessException;
import br.com.medflow.patient.exception.ResourceNotFoundException;
import br.com.medflow.patient.repository.PatientRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PatientService {
    private final PatientRepository repository;

    public PatientService(PatientRepository repository) {
        this.repository = repository;
    }

    public List<PatientResponse> findAll() {
        return repository.findAll().stream().map(PatientResponse::from).toList();
    }

    public PatientResponse findById(Long id) {
        Patient patient = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Paciente nao encontrado. id=" + id));
        return PatientResponse.from(patient);
    }

    public PatientResponse create(PatientRequest request) {
        if (repository.existsByCpf(request.cpf())) {
            throw new BusinessException("Ja existe paciente cadastrado com o cpf " + request.cpf());
        }
        Patient patient = new Patient(request.cpf(), request.fullName(), request.birthDate(),
                request.email(), request.phone(), request.healthPlan());
        return PatientResponse.from(repository.save(patient));
    }
}
