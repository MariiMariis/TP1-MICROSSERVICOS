package br.com.medflow.patient.controller;

import br.com.medflow.patient.dto.PatientRequest;
import br.com.medflow.patient.dto.PatientResponse;
import br.com.medflow.patient.service.PatientService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/patients")
public class PatientController {
    private final PatientService service;

    @Value("${server.port}")
    private String port;

    public PatientController(PatientService service) {
        this.service = service;
    }

    @GetMapping
    public List<PatientResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public PatientResponse findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PatientResponse create(@Valid @RequestBody PatientRequest request) {
        return service.create(request);
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
                "service", "patient-service",
                "port", port,
                "instance", hostname()
        );
    }

    private String hostname() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException ex) {
            return "unknown";
        }
    }
}
