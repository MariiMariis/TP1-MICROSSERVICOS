package br.com.medflow.appointment.client;

import br.com.medflow.appointment.exception.PatientNotFoundException;
import br.com.medflow.appointment.exception.PatientServiceUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

@Component
public class PatientClient {
    private static final Logger log = LoggerFactory.getLogger(PatientClient.class);

    private final RestClient restClient;
    private final String baseUrl;

    public PatientClient(RestClient.Builder builder,
                         @Value("${medflow.patient-service.url}") String baseUrl) {
        this.baseUrl = baseUrl;
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    public PatientSnapshot findById(Long patientId) {
        log.info("Consultando {}/patients/{}", baseUrl, patientId);
        try {
            return restClient.get()
                    .uri("/patients/{id}", patientId)
                    .retrieve()
                    .body(PatientSnapshot.class);
        } catch (HttpClientErrorException.NotFound ex) {
            throw new PatientNotFoundException("Paciente nao encontrado no patient-service. id=" + patientId);
        } catch (ResourceAccessException ex) {
            throw new PatientServiceUnavailableException(
                    "patient-service inacessivel em " + baseUrl + ": " + ex.getMessage());
        }
    }
}
