package br.com.medflow.appointment.controller;

import br.com.medflow.appointment.dto.AppointmentRequest;
import br.com.medflow.appointment.dto.AppointmentResponse;
import br.com.medflow.appointment.service.AppointmentService;
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

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/appointments")
public class AppointmentController {
    private final AppointmentService service;

    @Value("${server.port}")
    private String port;

    @Value("${medflow.patient-service.url}")
    private String patientServiceUrl;

    public AppointmentController(AppointmentService service) {
        this.service = service;
    }

    @GetMapping
    public List<AppointmentResponse> findAll() {
        return service.findAll();
    }

    @GetMapping("/{id}")
    public AppointmentResponse findById(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AppointmentResponse schedule(@Valid @RequestBody AppointmentRequest request) {
        return service.schedule(request);
    }

    @GetMapping("/info")
    public Map<String, String> info() {
        return Map.of(
                "service", "appointment-service",
                "port", port,
                "patientServiceUrl", patientServiceUrl
        );
    }
}
