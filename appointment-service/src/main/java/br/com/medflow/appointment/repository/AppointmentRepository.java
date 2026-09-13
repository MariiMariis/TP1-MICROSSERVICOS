package br.com.medflow.appointment.repository;

import br.com.medflow.appointment.domain.Appointment;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Repository
public class AppointmentRepository {
    private final Map<Long, Appointment> storage = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();

    public List<Appointment> findAll() {
        return storage.values().stream()
                .sorted(Comparator.comparing(Appointment::getId))
                .toList();
    }

    public Optional<Appointment> findById(Long id) {
        return Optional.ofNullable(storage.get(id));
    }

    public Appointment save(Appointment appointment) {
        if (appointment.getId() == null) {
            appointment.assignId(sequence.incrementAndGet());
        }
        storage.put(appointment.getId(), appointment);
        return appointment;
    }
}
