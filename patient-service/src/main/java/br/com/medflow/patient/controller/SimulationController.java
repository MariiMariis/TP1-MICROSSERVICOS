package br.com.medflow.patient.controller;

import br.com.medflow.patient.config.LatencySimulator;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/patients/simulation")
public class SimulationController {
    private final LatencySimulator latencySimulator;

    public SimulationController(LatencySimulator latencySimulator) {
        this.latencySimulator = latencySimulator;
    }

    @GetMapping("/latency")
    public Map<String, Object> current() {
        return Map.of(
                "latenciaAtualMs", latencySimulator.currentDelay(),
                "situacao", latencySimulator.currentDelay() == 0 ? "normal" : "lento (simulado)"
        );
    }

    @PostMapping("/latency")
    public Map<String, Object> enable(@RequestParam long millis) {
        latencySimulator.setDelay(millis);
        return Map.of(
                "latenciaAtualMs", latencySimulator.currentDelay(),
                "mensagem", "GET /api/patients/{id} agora demora " + millis
                        + " ms. O appointment-service tem read-timeout de 3000 ms."
        );
    }

    @DeleteMapping("/latency")
    public Map<String, Object> disable() {
        latencySimulator.reset();
        return Map.of(
                "latenciaAtualMs", 0,
                "mensagem", "Latencia artificial desativada. O servico voltou ao normal."
        );
    }
}
