package br.com.medflow.medicalrecord.service;

import br.com.medflow.medicalrecord.domain.MedicalRecord;
import br.com.medflow.medicalrecord.domain.RecordType;
import br.com.medflow.medicalrecord.dto.MedicalRecordRequest;
import br.com.medflow.medicalrecord.dto.MedicalRecordResponse;
import br.com.medflow.medicalrecord.exception.ResourceNotFoundException;
import br.com.medflow.medicalrecord.repository.MedicalRecordRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MedicalRecordService {
    private final MedicalRecordRepository repository;

    public MedicalRecordService(MedicalRecordRepository repository) {
        this.repository = repository;
    }

    public List<MedicalRecordResponse> findAll() {
        return repository.findAll().stream().map(MedicalRecordResponse::from).toList();
    }

    public MedicalRecordResponse findById(String id) {
        MedicalRecord record = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Registro clinico nao encontrado. id=" + id));
        return MedicalRecordResponse.from(record);
    }

    public List<MedicalRecordResponse> findByPatient(Long patientId) {
        return repository.findByPatientIdOrderByOccurredAtDesc(patientId)
                .stream().map(MedicalRecordResponse::from).toList();
    }

    public List<MedicalRecordResponse> findBySpecialty(String specialty) {
        return repository.findBySpecialtyIgnoreCase(specialty)
                .stream().map(MedicalRecordResponse::from).toList();
    }

    public List<MedicalRecordResponse> findByRecordType(RecordType type) {
        return repository.findByRecordType(type).stream().map(MedicalRecordResponse::from).toList();
    }

    public List<MedicalRecordResponse> findByTag(String tag) {
        return repository.findByTagsContaining(tag).stream().map(MedicalRecordResponse::from).toList();
    }

    public List<MedicalRecordResponse> findByClinicalDataKey(String key) {
        return repository.findByClinicalDataKey(key).stream().map(MedicalRecordResponse::from).toList();
    }

    public MedicalRecordResponse create(MedicalRecordRequest request) {
        MedicalRecord record = new MedicalRecord(
                request.patientId(),
                request.patientName(),
                request.recordType(),
                request.specialty(),
                request.professional(),
                request.occurredAt(),
                request.tags(),
                request.clinicalData(),
                request.attachments()
        );
        return MedicalRecordResponse.from(repository.save(record));
    }

    public void delete(String id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Registro clinico nao encontrado. id=" + id);
        }
        repository.deleteById(id);
    }
}
