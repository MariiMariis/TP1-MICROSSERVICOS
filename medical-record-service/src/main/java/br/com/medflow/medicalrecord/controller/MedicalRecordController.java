package br.com.medflow.medicalrecord.controller;

import br.com.medflow.medicalrecord.domain.RecordType;
import br.com.medflow.medicalrecord.dto.MedicalRecordRequest;
import br.com.medflow.medicalrecord.dto.MedicalRecordResponse;
import br.com.medflow.medicalrecord.service.MedicalRecordService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/medical-records")
public class MedicalRecordController {
    private final MedicalRecordService service;

    @Value("${server.port}")
    private String port;

    public MedicalRecordController(MedicalRecordService service) {
        this.service = service;
    }

    @GetMapping
    public List<MedicalRecordResponse> search(@RequestParam(required = false) String specialty,
                                              @RequestParam(required = false) RecordType type,
                                              @RequestParam(required = false) String tag,
                                              @RequestParam(required = false) String clinicalDataKey) {
        if (specialty != null && !specialty.isBlank()) {
            return service.findBySpecialty(specialty);
        }
        if (type != null) {
            return service.findByRecordType(type);
        }
        if (tag != null && !tag.isBlank()) {
            return service.findByTag(tag);
        }
        if (clinicalDataKey != null && !clinicalDataKey.isBlank()) {
            return service.findByClinicalDataKey(clinicalDataKey);
        }
        return service.findAll();
    }

    @GetMapping("/{id}")
    public MedicalRecordResponse findById(@PathVariable String id) {
        return service.findById(id);
    }

    @GetMapping("/patient/{patientId}")
    public List<MedicalRecordResponse> findByPatient(@PathVariable Long patientId) {
        return service.findByPatient(patientId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MedicalRecordResponse create(@Valid @RequestBody MedicalRecordRequest request) {
        return service.create(request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
                "service", "medical-record-service",
                "port", port,
                "database", "MongoDB / medflow_medical_records",
                "motivoNoSQL", "documentos clinicos com estrutura variavel por especialidade"
        );
    }
}
