package br.com.medflow.patient.controller;

import br.com.medflow.patient.config.LatencySimulator;
import br.com.medflow.patient.dto.PatientRequest;
import br.com.medflow.patient.dto.PatientResponse;
import br.com.medflow.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/patients")
public class PatientController {
    private final PatientService service;
    private final LatencySimulator latencySimulator;

    @Value("${server.port}")
    private String port;

    public PatientController(PatientService service, LatencySimulator latencySimulator) {
        this.service = service;
        this.latencySimulator = latencySimulator;
    }

    @GetMapping
    public List<PatientResponse> findAll(@RequestParam(required = false) String name) {
        return (name == null || name.isBlank()) ? service.findAll() : service.searchByName(name);
    }

    @GetMapping("/{id}")
    public PatientResponse findById(@PathVariable Long id) {
        latencySimulator.applyIfConfigured();
        return service.findById(id);
    }

    @GetMapping("/cpf/{cpf}")
    public PatientResponse findByCpf(@PathVariable String cpf) {
        return service.findByCpf(cpf);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientResponse create(@Valid @RequestBody PatientRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public PatientResponse update(@PathVariable Long id, @Valid @RequestBody PatientRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivate(@PathVariable Long id) {
        service.deactivate(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
                "service", "patient-service",
                "port", port,
                "database", "PostgreSQL / medflow_patients"
        );
    }
}
