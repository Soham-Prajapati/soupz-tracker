import 'package:flutter/foundation.dart';

typedef JsonMap = Map<String, Object?>;

const trackerSchemaVersion = 1;

Never _invalid(String path, String message) {
  throw FormatException('$path $message');
}

String _string(JsonMap json, String key) {
  final value = json[key];
  return value is String && value.isNotEmpty
      ? value
      : _invalid(key, 'must be a non-empty string');
}

int _integer(JsonMap json, String key) {
  final value = json[key];
  return value is int ? value : _invalid(key, 'must be an integer');
}

List<Object?> _list(JsonMap json, String key) {
  final value = json[key];
  return value is List<Object?> ? value : _invalid(key, 'must be a list');
}

JsonMap _map(Object? value, String path) {
  return value is Map<String, Object?>
      ? value
      : _invalid(path, 'must be an object');
}

void _version(JsonMap json) {
  if (_integer(json, 'schemaVersion') != trackerSchemaVersion) {
    _invalid('schemaVersion', 'is unsupported');
  }
}

final class PlanContract {
  const PlanContract({
    required this.id,
    required this.title,
    required this.kind,
    required this.timezone,
    required this.revision,
    required this.tracks,
    required this.recurrences,
    required this.schedule,
    required this.events,
  });

  factory PlanContract.fromJson(JsonMap json) {
    _version(json);
    final kind = _string(json, 'kind');
    if (!const {'plan', 'habit', 'hackathon', 'pack'}.contains(kind)) {
      _invalid('kind', 'is unsupported');
    }
    return PlanContract(
      id: _string(json, 'id'),
      title: _string(json, 'title'),
      kind: kind,
      timezone: _string(json, 'timezone'),
      revision: _integer(json, 'revision'),
      tracks: _list(
        json,
        'tracks',
      ).map((value) => _map(value, 'tracks[]')).toList(growable: false),
      recurrences: _list(
        json,
        'recurrences',
      ).map((value) => _map(value, 'recurrences[]')).toList(growable: false),
      schedule: _list(
        json,
        'schedule',
      ).map((value) => _map(value, 'schedule[]')).toList(growable: false),
      events: _list(
        json,
        'events',
      ).map((value) => _map(value, 'events[]')).toList(growable: false),
    );
  }

  final String id;
  final String title;
  final String kind;
  final String timezone;
  final int revision;
  final List<JsonMap> tracks;
  final List<JsonMap> recurrences;
  final List<JsonMap> schedule;
  final List<JsonMap> events;
}

final class TodayTaskContract {
  const TodayTaskContract({
    required this.id,
    required this.title,
    required this.done,
    this.track,
    this.accentHex,
  });

  factory TodayTaskContract.fromJson(JsonMap json) => TodayTaskContract(
    id: _string(json, 'id'),
    title: _string(json, 'title'),
    done: json['done'] == true,
    track: json['track'] as String?,
    accentHex: json['accentHex'] as String?,
  );

  final String id;
  final String title;
  final bool done;
  final String? track;
  final String? accentHex;

  JsonMap toJson() => {
    'id': id,
    'title': title,
    'done': done,
    if (track != null) 'track': track,
    if (accentHex != null) 'accentHex': accentHex,
  };
}

final class TodayResourceContract {
  const TodayResourceContract({
    required this.date,
    required this.timezone,
    required this.tasks,
  });

  factory TodayResourceContract.fromJson(JsonMap json) {
    _version(json);
    return TodayResourceContract(
      date: _string(json, 'date'),
      timezone: _string(json, 'timezone'),
      tasks: _list(json, 'tasks')
          .map((value) => TodayTaskContract.fromJson(_map(value, 'tasks[]')))
          .toList(growable: false),
    );
  }

  final String date;
  final String timezone;
  final List<TodayTaskContract> tasks;
  int get completed => tasks.where((task) => task.done).length;
}

enum AccentPreset { miso, tomato, matcha, beetroot, kombu, charcoal }

const accentPresetHex = <AccentPreset, String>{
  AccentPreset.miso: '#E2963C',
  AccentPreset.tomato: '#D4553A',
  AccentPreset.matcha: '#7FA23C',
  AccentPreset.beetroot: '#B2456F',
  AccentPreset.kombu: '#2F8C86',
  AccentPreset.charcoal: '#6A5B4A',
};

final class AccentChoice {
  const AccentChoice.preset(this.preset) : customHex = null;
  const AccentChoice.custom(this.customHex) : preset = null;

  factory AccentChoice.fromJson(JsonMap json) {
    final presetName = json['preset'];
    if (presetName is String) {
      return AccentChoice.preset(AccentPreset.values.byName(presetName));
    }
    final custom = json['customHex'];
    if (custom is String && RegExp(r'^#[0-9A-Fa-f]{6}$').hasMatch(custom)) {
      return AccentChoice.custom(custom.toUpperCase());
    }
    return _invalid('accent', 'must contain a preset or six-digit customHex');
  }

  final AccentPreset? preset;
  final String? customHex;
  String get resolvedHex => customHex ?? accentPresetHex[preset]!;
  JsonMap toJson() =>
      preset != null ? {'preset': preset!.name} : {'customHex': customHex};
}

final class HomeWidgetPayload {
  const HomeWidgetPayload({
    required this.date,
    required this.completed,
    required this.total,
    required this.tasks,
    required this.accent,
  });

  factory HomeWidgetPayload.fromToday(
    TodayResourceContract today,
    AccentChoice accent,
  ) => HomeWidgetPayload(
    date: today.date,
    completed: today.completed,
    total: today.tasks.length,
    tasks: today.tasks.take(6).toList(growable: false),
    accent: accent,
  );

  factory HomeWidgetPayload.fromJson(JsonMap json) {
    _version(json);
    return HomeWidgetPayload(
      date: _string(json, 'date'),
      completed: _integer(json, 'completed'),
      total: _integer(json, 'total'),
      tasks: _list(json, 'tasks')
          .map((value) => TodayTaskContract.fromJson(_map(value, 'tasks[]')))
          .toList(growable: false),
      accent: AccentChoice.fromJson(_map(json['accent'], 'accent')),
    );
  }

  final String date;
  final int completed;
  final int total;
  final List<TodayTaskContract> tasks;
  final AccentChoice accent;

  JsonMap toJson() => {
    'schemaVersion': trackerSchemaVersion,
    'date': date,
    'completed': completed,
    'total': total,
    'tasks': tasks.map((task) => task.toJson()).toList(growable: false),
    'accent': accent.toJson(),
  };
}

enum NativeHapticBoundary { unavailable, systemImpactOnly }

final class NativeCapabilityContract {
  const NativeCapabilityContract({
    required this.homeWidget,
    required this.haptics,
    required this.authoredHapticPatterns,
  });

  factory NativeCapabilityContract.forTarget(TargetPlatform platform) {
    final mobile =
        platform == TargetPlatform.iOS || platform == TargetPlatform.android;
    return NativeCapabilityContract(
      homeWidget: false,
      haptics: mobile
          ? NativeHapticBoundary.systemImpactOnly
          : NativeHapticBoundary.unavailable,
      authoredHapticPatterns: false,
    );
  }

  final bool homeWidget;
  final NativeHapticBoundary haptics;
  final bool authoredHapticPatterns;
}
