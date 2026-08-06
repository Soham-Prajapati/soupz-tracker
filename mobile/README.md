# Soupz Tracker mobile contract

This is a minimal compilable Flutter scaffold, not a claimed full mobile product.

It establishes four versioned boundaries shared with the Tracker engine:

- `PlanContract` consumes schema version 1 plans (`plan`, `habit`, `hackathon`, or `pack`).
- `TodayResourceContract` consumes the same projected today-task shape intended for
  `soupz://plan/{id}/today`.
- `HomeWidgetPayload` is a small native handoff: date, counts, at most six tasks, and
  the chosen accent.
- `AccentChoice` accepts the approved named presets or a six-digit custom hex value.

Native haptics are deliberately bounded. iOS and Android may use Flutter's system impact
feedback after a user action. This scaffold does not promise authored haptic patterns,
background effects, or web vibration parity. No home-widget or haptics plugin is installed;
native host implementation comes after this contract is accepted.

Fixtures live in `assets/fixtures/` and are validated by `flutter test`.
