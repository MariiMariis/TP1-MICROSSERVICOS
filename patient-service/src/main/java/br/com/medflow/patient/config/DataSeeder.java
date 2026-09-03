package br.com.medflow.patient.config;

import br.com.medflow.patient.domain.Patient;
import br.com.medflow.patient.repository.PatientRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

/**
 * Carga inicial de pacientes a partir de infra/seed/patients.json (empacotado como seed/patients.json).
 *
 * O mesmo arquivo alimenta o seed do medical-record-service, garantindo que o id gerado aqui
 * (IDENTITY, sequencial a partir de 1 em uma tabela vazia) coincida com o patientId do Mongo.
 * Por isso a carga so acontece com a tabela vazia: numa tabela ja populada, os ids nao bateriam.
 */
@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String SEED_FILE = "seed/patients.json";

    private final PatientRepository repository;
    private final ObjectMapper objectMapper;

    public DataSeeder(PatientRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(String... args) throws IOException {
        long existing = repository.count();
        if (existing > 0) {
            log.info("Base de pacientes ja populada ({} registros). Seed ignorado. " +
                    "Para recarregar os 120 pacientes da demo: docker compose down -v", existing);
            return;
        }

        List<SeedPatient> seed;
        try (InputStream in = new ClassPathResource(SEED_FILE).getInputStream()) {
            seed = objectMapper.readValue(in, new TypeReference<>() {});
        }

        // Insere na ordem do arquivo para que o id N seja o paciente N.
        List<Patient> patients = seed.stream()
                .sorted((a, b) -> Long.compare(a.id(), b.id()))
                .map(s -> new Patient(s.cpf(), s.fullName(), s.birthDate(), s.email(), s.phone(), s.healthPlan()))
                .toList();

        repository.saveAll(patients);
        log.info("Seed concluido: {} pacientes cadastrados no medflow_patients a partir de {}.", patients.size(), SEED_FILE);
    }
}
