package br.com.medflow.appointment.controller;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/appointments/resilience")
public class ResilienceController {
    private static final String INSTANCE = "patient-service";

    private final CircuitBreakerRegistry registry;

    public ResilienceController(CircuitBreakerRegistry registry) {
        this.registry = registry;
    }

    @GetMapping("/circuit-breaker")
    public Map<String, Object> circuitBreakerStatus() {
        CircuitBreaker circuitBreaker = registry.circuitBreaker(INSTANCE);
        CircuitBreaker.Metrics metrics = circuitBreaker.getMetrics();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("instancia", INSTANCE);
        body.put("estado", circuitBreaker.getState().name());
        body.put("descricaoDoEstado", describe(circuitBreaker.getState()));
        body.put("chamadasNaJanela", metrics.getNumberOfBufferedCalls());
        body.put("chamadasComSucesso", metrics.getNumberOfSuccessfulCalls());
        body.put("chamadasComFalha", metrics.getNumberOfFailedCalls());
        body.put("chamadasLentas", metrics.getNumberOfSlowCalls());
        body.put("taxaDeFalhaPercentual", metrics.getFailureRate());
        body.put("chamadasNaoPermitidas", metrics.getNumberOfNotPermittedCalls());
        return body;
    }

    private String describe(CircuitBreaker.State state) {
        return switch (state) {
            case CLOSED -> "Circuito fechado: chamadas ao patient-service estao passando normalmente.";
            case OPEN -> "Circuito ABERTO: chamadas sao rejeitadas de imediato e o fallback assume.";
            case HALF_OPEN -> "Circuito meio-aberto: liberando poucas chamadas para testar a recuperacao.";
            case DISABLED -> "Circuit Breaker desabilitado.";
            case FORCED_OPEN -> "Circuito forcado como aberto.";
            case METRICS_ONLY -> "Coletando metricas sem interromper chamadas.";
        };
    }
}
