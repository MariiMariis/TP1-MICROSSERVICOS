package br.com.medflow.patient.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicLong;

@Component
public class LatencySimulator {
    private static final Logger log = LoggerFactory.getLogger(LatencySimulator.class);

    private final AtomicLong delayMillis = new AtomicLong(0);

    public void setDelay(long millis) {
        delayMillis.set(Math.max(0, millis));
        log.warn("Latencia artificial ajustada para {} ms.", delayMillis.get());
    }

    public void reset() {
        delayMillis.set(0);
        log.info("Latencia artificial desativada.");
    }

    public long currentDelay() {
        return delayMillis.get();
    }

    public void applyIfConfigured() {
        long delay = delayMillis.get();
        if (delay <= 0) {
            return;
        }
        try {
            log.warn("Simulando lentidao de {} ms nesta requisicao.", delay);
            Thread.sleep(delay);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        }
    }
}
