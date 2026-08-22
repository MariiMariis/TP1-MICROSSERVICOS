package br.com.medflow.medicalrecord.config;

import br.com.medflow.medicalrecord.domain.Attachment;
import br.com.medflow.medicalrecord.domain.MedicalRecord;
import br.com.medflow.medicalrecord.domain.RecordType;
import br.com.medflow.medicalrecord.repository.MedicalRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
public class DataSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final MedicalRecordRepository repository;

    public DataSeeder(MedicalRecordRepository repository) {
        this.repository = repository;
    }

    @Override
    public void run(String... args) {
        if (repository.count() > 0) {
            log.info("Prontuario ja populado ({} documentos). Seed ignorado.", repository.count());
            return;
        }

        MedicalRecord cardiologia = new MedicalRecord(
                1L, "Ana Paula Ribeiro", RecordType.CONSULTA, "Cardiologia",
                "Dr. Helio Vasconcelos", LocalDateTime.now().minusDays(30),
                List.of("hipertensao", "acompanhamento"),
                Map.of(
                        "pressaoArterial", Map.of("sistolica", 148, "diastolica", 94, "unidade", "mmHg"),
                        "frequenciaCardiaca", 88,
                        "ecg", Map.of("ritmo", "sinusal", "alteracoes", List.of("sobrecarga ventricular esquerda")),
                        "fracaoEjecao", 58.5,
                        "medicacoesEmUso", List.of("Losartana 50mg", "Hidroclorotiazida 25mg")
                ),
                List.of(new Attachment("ecg-2026-07.pdf", "application/pdf", "/laudos/ecg-2026-07.pdf", 420))
        );

        MedicalRecord oftalmologia = new MedicalRecord(
                2L, "Carlos Eduardo Souza", RecordType.CONSULTA, "Oftalmologia",
                "Dra. Renata Camargo", LocalDateTime.now().minusDays(12),
                List.of("miopia", "rotina"),
                Map.of(
                        "acuidadeVisual", Map.of("olhoDireito", "20/40", "olhoEsquerdo", "20/30"),
                        "pressaoIntraocular", Map.of("olhoDireito", 16, "olhoEsquerdo", 15, "unidade", "mmHg"),
                        "refracao", Map.of(
                                "olhoDireito", Map.of("esferico", -2.25, "cilindrico", -0.75, "eixo", 180),
                                "olhoEsquerdo", Map.of("esferico", -1.75, "cilindrico", -0.50, "eixo", 175)
                        ),
                        "fundoDeOlho", "sem alteracoes"
                ),
                List.of()
        );

        MedicalRecord laboratorio = new MedicalRecord(
                1L, "Ana Paula Ribeiro", RecordType.EXAME, "Analises Clinicas",
                "Laboratorio MedFlow", LocalDateTime.now().minusDays(28),
                List.of("hemograma", "perfil-lipidico"),
                Map.of(
                        "hemograma", Map.of(
                                "hemoglobina", Map.of("valor", 13.8, "unidade", "g/dL", "referencia", "12.0-16.0"),
                                "leucocitos", Map.of("valor", 7200, "unidade", "/mm3", "referencia", "4000-11000"),
                                "plaquetas", Map.of("valor", 245000, "unidade", "/mm3", "referencia", "150000-450000")
                        ),
                        "perfilLipidico", Map.of(
                                "colesterolTotal", 214,
                                "hdl", 48,
                                "ldl", 141,
                                "triglicerides", 176
                        ),
                        "jejumHoras", 12
                ),
                List.of(new Attachment("hemograma.pdf", "application/pdf", "/laudos/hemograma.pdf", 180),
                        new Attachment("lipidograma.pdf", "application/pdf", "/laudos/lipidograma.pdf", 165))
        );

        MedicalRecord vacina = new MedicalRecord(
                3L, "Marina Lopes Ferreira", RecordType.VACINA, "Imunizacao",
                "Enf. Paula Andrade", LocalDateTime.now().minusDays(5),
                List.of("influenza", "campanha-2026"),
                Map.of(
                        "imunobiologico", "Influenza Quadrivalente",
                        "lote", "IF-2026-A317",
                        "fabricante", "Instituto Butantan",
                        "dose", "unica",
                        "viaAdministracao", "intramuscular",
                        "localAplicacao", "deltoide esquerdo"
                ),
                List.of()
        );

        repository.saveAll(List.of(cardiologia, oftalmologia, laboratorio, vacina));
        log.info("Seed concluido: 4 registros clinicos heterogeneos gravados no medflow_medical_records.");
    }
}
