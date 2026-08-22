package br.com.medflow.appointment.client;

import br.com.medflow.appointment.exception.PatientNotFoundException;
import feign.FeignException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class PatientGateway {
    private static final Logger log = LoggerFactory.getLogger(PatientGateway.class);

    private final PatientClient patientClient;

    public PatientGateway(PatientClient patientClient) {
        this.patientClient = patientClient;
    }

    @CircuitBreaker(name = "patient-service", fallbackMethod = "findPatientFallback")
    public PatientSnapshot findPatient(Long patientId) {
        try {
            PatientSnapshot snapshot = patientClient.findById(patientId);
            log.debug("patient-service respondeu para o paciente {}: {}", patientId, snapshot.fullName());
            return snapshot;
        } catch (FeignException.NotFound ex) {
            throw new PatientNotFoundException("Paciente nao encontrado no patient-service. id=" + patientId);
        }
    }

    @SuppressWarnings("unused")
    private PatientSnapshot findPatientFallback(Long patientId, Throwable throwable) {
        if (throwable instanceof PatientNotFoundException notFound) {
            throw notFound;
        }

        String reason = describe(throwable);
        log.warn("FALLBACK ACIONADO para o paciente {} -> {}. O agendamento seguira em modo degradado.",
                patientId, reason);
        return PatientSnapshot.fallbackFor(patientId, reason);
    }

    private String describe(Throwable throwable) {
        if (throwable instanceof io.github.resilience4j.circuitbreaker.CallNotPermittedException) {
            return "circuito ABERTO";
        }
        if (throwable instanceof feign.RetryableException) {
            return "timeout ou servico inacessivel";
        }
        return throwable.getClass().getSimpleName();
    }
}
