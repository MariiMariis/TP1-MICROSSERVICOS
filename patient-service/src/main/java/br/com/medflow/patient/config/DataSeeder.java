package br.com.medflow.patient.config;

import br.com.medflow.patient.domain.Patient;
import br.com.medflow.patient.repository.PatientRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final PatientRepository repository;

    public DataSeeder(PatientRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        List<Patient> patients = List.of(
                new Patient("11122233344", "Ana Paula Ribeiro", LocalDate.of(1988, 3, 12),
                        "ana.ribeiro@email.com", "31988880001", "Unimed"),
                new Patient("22233344455", "Carlos Eduardo Souza", LocalDate.of(1975, 11, 2),
                        "carlos.souza@email.com", "31988880002", "SUS"),
                new Patient("33344455566", "Marina Lopes Ferreira", LocalDate.of(1996, 7, 25),
                        "marina.ferreira@email.com", "31988880003", "Particular"),
                new Patient("44455566677", "Roberto Nunes Almeida", LocalDate.of(1962, 1, 30),
                        "roberto.almeida@email.com", "31988880004", "Bradesco Saude")
        );
        patients.forEach(repository::save);
        log.info("Seed concluido: {} pacientes em memoria.", repository.count());
    }
}
